/**
 * SLA monitoring job.
 *
 * Runs every SLA_CRON_MINUTES (default 5 min) and applies two policies to
 * every live (non-closed, non-resolved, non-paused) ticket:
 *
 *   1) WARN  — if 0 < (sla_due_at − NOW()) ≤ SLA_WARN_MINUTES (default 60)
 *              and we haven't already warned this ticket, send the
 *              reporting manager an in-app notification and stamp
 *              tickets.sla_warned_at = NOW(). Idempotent: a ticket is
 *              warned at most once per breach cycle.
 *
 *   2) BREACH — if sla_due_at < NOW() and the ticket is still open and
 *               its current escalation_level is below SLA_AUTO_ESCALATE_MAX
 *               (default 1), increment escalation_level, flip status to
 *               'escalated', stamp escalated_at, and notify the reporting
 *               manager (level 1) or admins (level 2). Idempotent on
 *               escalation_level so the same ticket isn't re-escalated
 *               every 5 minutes.
 *
 * Both policies write an audit-log row so the dashboard / Audit Logs page
 * can render the same activity that's broadcast over websockets.
 *
 * Env knobs:
 *   SLA_CRON_MINUTES         (default 5)
 *   SLA_WARN_MINUTES         (default 60)
 *   SLA_AUTO_ESCALATE_MAX    (default 1)  — max escalation_level the cron
 *                                            will set automatically; humans
 *                                            still own anything above this.
 */
const cron = require('node-cron');
const { query } = require('../config/db');
const notifications = require('../services/notifications.service');
const { writeLog } = require('../middleware/audit');
const { emitBroadcast } = require('../config/socket');

const CRON_MINUTES         = Number(process.env.SLA_CRON_MINUTES        || 5);
const WARN_MINUTES         = Number(process.env.SLA_WARN_MINUTES        || 60);
const AUTO_ESCALATE_MAX    = Number(process.env.SLA_AUTO_ESCALATE_MAX   || 1);
const TZ                   = process.env.TZ || 'UTC';

const SCHEDULE = `*/${CRON_MINUTES} * * * *`; // every N minutes

/* ---------------------------------------------------------- Helpers ------ */

function fmtTicketNo(t) { return t.ticket_no || `#${t.id}`; }

async function getAdminIds() {
  const { rows } = await query(`SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE`);
  return rows.map((r) => r.id);
}

/* ---------------------------------------------------------- WARN pass ---- */

/**
 * Tickets nearing SLA breach: due in <= WARN_MINUTES, not yet warned, still
 * actively running (not closed/resolved/paused).
 */
async function runWarnPass() {
  const { rows } = await query(
    `SELECT id, ticket_no, subject, sla_due_at, reporting_manager_id, project_manager_id
       FROM tickets
      WHERE status NOT IN ('closed', 'resolved')
        AND sla_paused_at IS NULL
        AND sla_due_at IS NOT NULL
        AND sla_due_at > NOW()
        AND sla_due_at <= NOW() + ($1 || ' minutes')::interval
        AND sla_warned_at IS NULL`,
    [WARN_MINUTES]
  );
  if (rows.length === 0) return 0;

  for (const t of rows) {
    // Mark first so a slow notification doesn't cause repeat fires on the
    // next cron tick if this run takes a while.
    await query(`UPDATE tickets SET sla_warned_at = NOW() WHERE id = $1`, [t.id]);

    const mins = Math.max(0, Math.round((new Date(t.sla_due_at).getTime() - Date.now()) / 60000));
    const recipients = [t.reporting_manager_id, t.project_manager_id]
      .filter((id) => id && Number.isFinite(Number(id)));
    const fired = new Set();
    for (const userId of recipients) {
      if (fired.has(userId)) continue;
      fired.add(userId);
      await notifications.createAndEmit({
        user_id: userId,
        type: 'ticket.sla_warning',
        title: `SLA at risk on ${fmtTicketNo(t)}`,
        message: `${t.subject || 'Ticket'} — SLA due in ${mins} min`,
        link: `/tickets/${t.id}`,
      });
    }

    await writeLog({
      action: 'ticket.sla_warning',
      entity: 'tickets',
      entityId: t.id,
      meta: { remaining_minutes: mins, notified: Array.from(fired) },
    });
    emitBroadcast('ticket:sla_warning', { id: t.id, remaining_minutes: mins });
  }

  console.log(`[sla] warned ${rows.length} ticket(s) within ${WARN_MINUTES}m of breach`);
  return rows.length;
}

/* ---------------------------------------------------------- BREACH pass -- */

/**
 * Tickets past SLA: due in the past, still open, escalation_level can still
 * grow. We only increment up to AUTO_ESCALATE_MAX so humans remain
 * authoritative for L2+ paths.
 */
async function runBreachPass() {
  const { rows } = await query(
    `SELECT id, ticket_no, subject, sla_due_at, escalation_level,
            reporting_manager_id, project_manager_id
       FROM tickets
      WHERE status NOT IN ('closed', 'resolved')
        AND sla_paused_at IS NULL
        AND sla_due_at IS NOT NULL
        AND sla_due_at < NOW()
        AND escalation_level < $1`,
    [AUTO_ESCALATE_MAX]
  );
  if (rows.length === 0) return 0;

  const adminIds = await getAdminIds();

  for (const t of rows) {
    const newLevel = (t.escalation_level || 0) + 1;
    const overdueMin = Math.round((Date.now() - new Date(t.sla_due_at).getTime()) / 60000);

    await query(
      `UPDATE tickets SET
         escalation_level = $1,
         escalated_at     = NOW(),
         status           = 'escalated',
         updated_at       = NOW()
       WHERE id = $2`,
      [newLevel, t.id]
    );

    // L1 → reporting manager + project manager. L2 → all admins.
    const recipients = newLevel >= 2
      ? adminIds
      : [t.reporting_manager_id, t.project_manager_id].filter((id) => id && Number.isFinite(Number(id)));
    const fired = new Set();
    for (const userId of recipients) {
      if (fired.has(userId)) continue;
      fired.add(userId);
      await notifications.createAndEmit({
        user_id: userId,
        type: 'ticket.sla_breach',
        title: `SLA breached — ${fmtTicketNo(t)} (L${newLevel})`,
        message: `${t.subject || 'Ticket'} — overdue by ${overdueMin} min`,
        link: `/tickets/${t.id}`,
      });
    }

    await writeLog({
      action: 'ticket.sla_breach',
      entity: 'tickets',
      entityId: t.id,
      meta: { level: newLevel, overdue_minutes: overdueMin, notified: Array.from(fired) },
    });
    emitBroadcast('ticket:sla_breach', { id: t.id, level: newLevel, overdue_minutes: overdueMin });
  }

  console.log(`[sla] auto-escalated ${rows.length} breached ticket(s)`);
  return rows.length;
}

/* ---------------------------------------------------------- Driver ------- */

async function runOnce() {
  try {
    await runWarnPass();
    await runBreachPass();
  } catch (err) {
    // Never let the cron crash the server; just log and try again next tick.
    console.error('[sla] sweep failed:', err.message);
  }
}

function start() {
  if (!cron.validate(SCHEDULE)) {
    console.error(`[sla] invalid cron expression "${SCHEDULE}" — job not scheduled`);
    return;
  }
  cron.schedule(SCHEDULE, runOnce, { timezone: TZ });
  console.log(`[sla] scheduled: "${SCHEDULE}" (warn @ ${WARN_MINUTES}m, auto-escalate up to L${AUTO_ESCALATE_MAX})`);

  // One-shot catch-up shortly after boot so a long-stopped server doesn't
  // sit on breached tickets for 5 minutes.
  setTimeout(runOnce, 15_000);
}

module.exports = {
  start,
  runOnce,
  runWarnPass,
  runBreachPass,
  WARN_MINUTES,
  AUTO_ESCALATE_MAX,
};
