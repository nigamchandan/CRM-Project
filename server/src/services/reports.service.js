const { query } = require('../config/db');

exports.dashboard = async () => {
  const [users, contacts, leads, deals, tickets, tasks, leadsTrend, dealsTrend, ticketsTrend, revenueWon] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM users WHERE is_active=TRUE`),
    query(`SELECT COUNT(*)::int AS c FROM contacts`),
    query(`SELECT COUNT(*)::int AS c FROM leads`),
    query(`SELECT COUNT(*)::int AS c, COALESCE(SUM(value),0)::float AS v FROM deals`),
    query(`SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE status='open')::int AS open_c FROM tickets`),
    query(`SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE status='pending')::int AS pending_c FROM tasks`),
    // 7-day vs previous 7-day trend
    query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS this_period,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::int AS prev_period
      FROM leads
    `),
    query(`
      SELECT
        COALESCE(SUM(value) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),0)::float AS this_period,
        COALESCE(SUM(value) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'),0)::float AS prev_period
      FROM deals
    `),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS this_period,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::int AS prev_period
      FROM tickets
    `),
    query(`
      SELECT COALESCE(SUM(d.value),0)::float AS total
      FROM deals d
      LEFT JOIN pipeline_stages s ON s.id = d.stage_id
      WHERE LOWER(s.name) = 'won'
    `),
  ]);

  const pct = (cur, prev) => {
    if (!prev) return cur ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  return {
    users: users.rows[0].c,
    contacts: contacts.rows[0].c,
    leads: leads.rows[0].c,
    deals: { count: deals.rows[0].c, value: deals.rows[0].v, won_value: revenueWon.rows[0].total },
    tickets: { total: tickets.rows[0].c, open: tickets.rows[0].open_c },
    tasks: { total: tasks.rows[0].c, pending: tasks.rows[0].pending_c },
    trends: {
      leads:   { ...leadsTrend.rows[0],   change_pct: pct(leadsTrend.rows[0].this_period,   leadsTrend.rows[0].prev_period) },
      deals:   { ...dealsTrend.rows[0],   change_pct: pct(dealsTrend.rows[0].this_period,   dealsTrend.rows[0].prev_period) },
      tickets: { ...ticketsTrend.rows[0], change_pct: pct(ticketsTrend.rows[0].this_period, ticketsTrend.rows[0].prev_period) },
    },
  };
};

exports.recentActivity = async ({ limit = 10 } = {}) => {
  const { rows } = await query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.meta, l.created_at,
            u.name AS user_name, u.email AS user_email
     FROM logs l
     LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.created_at DESC
     LIMIT $1`, [Number(limit)]
  );
  return rows;
};

exports.upcomingTasks = async ({ limit = 6 } = {}) => {
  const { rows } = await query(
    `SELECT t.id, t.title, t.due_date, t.priority, t.status,
            u.name AS assigned_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.status <> 'completed'
     ORDER BY t.due_date NULLS LAST, t.created_at DESC
     LIMIT $1`, [Number(limit)]
  );
  return rows;
};

exports.salesFunnel = async () => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.color, s.position,
            COUNT(d.id)::int AS deal_count,
            COALESCE(SUM(d.value),0)::float AS total_value
     FROM pipeline_stages s
     LEFT JOIN deals d ON d.stage_id = s.id
     GROUP BY s.id
     ORDER BY s.position ASC`
  );
  return rows;
};

/* ---------------------------------------------------------------------
 *  Filter helpers shared by the four "primary" report queries.
 *
 *  All four accept an optional { from, to, team_id } and translate them
 *  into a SQL fragment scoped to the relevant date column. The frontend
 *  passes ISO strings (the same convention as the Audit Logs page).
 *
 *  When `team_id` is given:
 *    - leads filter on the assigned-user's team
 *    - deals filter on the owner's team
 *    - tickets filter directly on tickets.team_id
 * ------------------------------------------------------------------- */
function appendDateRange(where, params, col, from, to) {
  if (from) { params.push(from); where.push(`${col} >= $${params.length}::timestamptz`); }
  if (to)   { params.push(to);   where.push(`${col} <= $${params.length}::timestamptz`); }
}

exports.leadsByStatus = async ({ from, to, team_id } = {}) => {
  const params = [];
  const where  = [];
  appendDateRange(where, params, 'l.created_at', from, to);
  if (team_id) {
    params.push(Number(team_id));
    where.push(`u.team_id = $${params.length}`);
  }
  const sql = `
    SELECT l.status, COUNT(*)::int AS count
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_to
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY l.status
     ORDER BY l.status`;
  const { rows } = await query(sql, params);
  return rows;
};

exports.dealsByStage = async ({ from, to, team_id } = {}) => {
  const params = [];
  const where  = [];
  appendDateRange(where, params, 'd.created_at', from, to);
  if (team_id) {
    params.push(Number(team_id));
    where.push(`u.team_id = $${params.length}`);
  }
  const sql = `
    SELECT s.id, s.name, s.color,
           COUNT(d.id)::int AS count,
           COALESCE(SUM(d.value),0)::float AS total_value
      FROM pipeline_stages s
      LEFT JOIN deals d ON d.stage_id = s.id
        ${where.length ? 'AND ' + where.join(' AND ') : ''}
      LEFT JOIN users u ON u.id = d.owner_id
     GROUP BY s.id
     ORDER BY s.position ASC`;
  const { rows } = await query(sql, params);
  return rows;
};

exports.ticketsResolution = async ({ from, to, team_id } = {}) => {
  const params = [];
  const where  = [];
  appendDateRange(where, params, 'created_at', from, to);
  if (team_id) {
    params.push(Number(team_id));
    where.push(`team_id = $${params.length}`);
  }
  const sql = `
    SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status='open')::int AS open_count,
       COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress_count,
       COUNT(*) FILTER (WHERE status='resolved')::int AS resolved_count,
       COUNT(*) FILTER (WHERE status='closed')::int AS closed_count,
       COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE resolved_at IS NOT NULL), 0)::float AS avg_resolution_hours
      FROM tickets
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  const { rows } = await query(sql, params);
  return rows[0];
};

exports.revenueTrend = async ({ from, to, team_id } = {}) => {
  const params = [];
  // Default window: last 12 months when caller didn't constrain it.
  const where  = [`d.created_at > COALESCE($1::timestamptz, NOW() - INTERVAL '12 months')`];
  params.push(from || null);
  if (to) {
    params.push(to);
    where.push(`d.created_at <= $${params.length}::timestamptz`);
  }
  if (team_id) {
    params.push(Number(team_id));
    where.push(`u.team_id = $${params.length}`);
  }
  const sql = `
    SELECT to_char(date_trunc('month', d.created_at), 'YYYY-MM') AS month,
           COALESCE(SUM(d.value),0)::float AS total_value,
           COUNT(*)::int AS deals
      FROM deals d
      LEFT JOIN users u ON u.id = d.owner_id
     WHERE ${where.join(' AND ')}
     GROUP BY 1
     ORDER BY 1 ASC`;
  const { rows } = await query(sql, params);
  return rows;
};

/* ---------------------------------------------------------------------
 *  Drill-down endpoints. Used by the Reports page when the user clicks a
 *  pie slice / bar — we return a small (max 50 row) listing of the
 *  underlying records so the chart isn't a dead-end.
 * ------------------------------------------------------------------- */
exports.leadsForStatus = async (status, { from, to, team_id } = {}) => {
  const params = [String(status)];
  const where  = ['l.status = $1'];
  appendDateRange(where, params, 'l.created_at', from, to);
  if (team_id) {
    params.push(Number(team_id));
    where.push(`u.team_id = $${params.length}`);
  }
  const sql = `
    SELECT l.id, l.name, l.company, l.value, l.created_at,
           u.name AS owner_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_to
     WHERE ${where.join(' AND ')}
     ORDER BY l.created_at DESC
     LIMIT 50`;
  const { rows } = await query(sql, params);
  return rows;
};

exports.dealsForStage = async (stageId, { from, to, team_id } = {}) => {
  const params = [Number(stageId)];
  const where  = ['d.stage_id = $1'];
  appendDateRange(where, params, 'd.created_at', from, to);
  if (team_id) {
    params.push(Number(team_id));
    where.push(`u.team_id = $${params.length}`);
  }
  const sql = `
    SELECT d.id, d.title, d.value, d.created_at,
           u.name AS owner_name
      FROM deals d
      LEFT JOIN users u ON u.id = d.owner_id
     WHERE ${where.join(' AND ')}
     ORDER BY d.created_at DESC
     LIMIT 50`;
  const { rows } = await query(sql, params);
  return rows;
};

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD: Team performance
// Ranks active users by a combined contribution score:
//   deals_value (won + open) + 1000 * tickets_resolved + 500 * leads_converted
// ---------------------------------------------------------------------------
exports.teamPerformance = async ({ limit = 5 } = {}) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.avatar_url,
            COALESCE(d.deals_value, 0)::float  AS deals_value,
            COALESCE(d.deals_count, 0)::int    AS deals_count,
            COALESCE(d.won_value,   0)::float  AS won_value,
            COALESCE(l.leads_count, 0)::int    AS leads_count,
            COALESCE(l.converted_count, 0)::int AS converted_count,
            COALESCE(t.resolved_count, 0)::int AS tickets_resolved
       FROM users u
       LEFT JOIN (
         SELECT d.owner_id,
                COUNT(*)::int               AS deals_count,
                SUM(d.value)::float         AS deals_value,
                SUM(d.value) FILTER (WHERE LOWER(s.name) = 'won')::float AS won_value
           FROM deals d
           LEFT JOIN pipeline_stages s ON s.id = d.stage_id
          GROUP BY d.owner_id
       ) d ON d.owner_id = u.id
       LEFT JOIN (
         SELECT assigned_to,
                COUNT(*)::int                                          AS leads_count,
                COUNT(*) FILTER (WHERE status = 'converted')::int      AS converted_count
           FROM leads
          GROUP BY assigned_to
       ) l ON l.assigned_to = u.id
       LEFT JOIN (
         SELECT assigned_to,
                COUNT(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved_count
           FROM tickets
          GROUP BY assigned_to
       ) t ON t.assigned_to = u.id
      WHERE u.is_active = TRUE
      ORDER BY (
        COALESCE(d.deals_value, 0)
        + COALESCE(t.resolved_count, 0) * 1000
        + COALESCE(l.converted_count, 0) * 500
      ) DESC
      LIMIT $1`,
    [Number(limit)]
  );
  return rows;
};

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD: SLA performance for tickets
// Considers a "within-SLA" resolution as <= 24h.
// ---------------------------------------------------------------------------
exports.slaPerformance = async () => {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int                                                                       AS total,
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int                                AS resolved,
       COALESCE(
         AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
           FILTER (WHERE resolved_at IS NOT NULL),
         0
       )::float                                                                            AS avg_resolution_hours,
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at - created_at <= INTERVAL '24 hours')::int AS within_24h,
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at - created_at <= INTERVAL '48 hours')::int AS within_48h,
       COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND created_at < NOW() - INTERVAL '24 hours')::int AS breached_open
     FROM tickets`
  );
  const r = rows[0];
  const sla_pct = r.resolved ? Math.round((r.within_24h / r.resolved) * 100) : 0;
  return { ...r, sla_pct };
};

// ===========================================================================
// SLA CONFIG — response-time targets (hours) by ticket priority
// ===========================================================================
const SLA_HOURS_BY_PRIORITY = { high: 4, medium: 24, low: 72 };

// Helper: shape a row with SLA fields for the support dashboard
function withSla(row) {
  const target = SLA_HOURS_BY_PRIORITY[row.priority] ?? 24;
  const ageMs    = Date.now() - new Date(row.created_at).getTime();
  const ageHours = ageMs / 3600_000;
  const remaining_minutes = Math.round((target - ageHours) * 60);
  const breached = remaining_minutes < 0;
  return {
    ...row,
    sla_target_hours: target,
    age_hours: Number(ageHours.toFixed(2)),
    sla_remaining_minutes: remaining_minutes,
    sla_breached: breached,
    sla_status: breached
      ? 'breached'
      : remaining_minutes < 60
        ? 'critical'
        : remaining_minutes < target * 60 * 0.5
          ? 'warning'
          : 'healthy',
  };
}

exports.SLA_HOURS_BY_PRIORITY = SLA_HOURS_BY_PRIORITY;

// ===========================================================================
// SUPPORT DASHBOARD — per-user (scoped to current support user)
// ===========================================================================

// My ticket KPIs + SLA snapshot
exports.myTicketsDashboard = async (userId) => {
  const buckets = await query(
    `SELECT
       COUNT(*)::int                                                            AS total,
       COUNT(*) FILTER (WHERE status='open')::int                               AS open_c,
       COUNT(*) FILTER (WHERE status='in_progress')::int                        AS in_progress,
       COUNT(*) FILTER (WHERE status IN ('resolved','closed'))::int             AS resolved,
       COUNT(*) FILTER (WHERE priority='high'   AND status IN ('open','in_progress'))::int AS high_open,
       COUNT(*) FILTER (WHERE status IN ('open','in_progress')
                        AND created_at < NOW() - INTERVAL '24 hours')::int      AS overdue_24h,
       COUNT(*) FILTER (WHERE status IN ('resolved','closed')
                        AND resolved_at >= NOW() - INTERVAL '7 days')::int      AS resolved_7d
       FROM tickets
      WHERE assigned_to = $1`,
    [userId]
  );

  // Priority-aware SLA breach count: any open ticket where age > target hours for its priority
  const breach = await query(
    `SELECT COUNT(*)::int AS breached
       FROM tickets
      WHERE assigned_to = $1
        AND status IN ('open','in_progress')
        AND (
             (priority = 'high'   AND created_at < NOW() - INTERVAL '4 hours')
          OR (priority = 'medium' AND created_at < NOW() - INTERVAL '24 hours')
          OR (priority = 'low'    AND created_at < NOW() - INTERVAL '72 hours')
        )`,
    [userId]
  );

  // Avg resolution time (last 30 days)
  const avgRes = await query(
    `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600), 0)::float AS avg_hours,
            COUNT(*)::int AS n
       FROM tickets
      WHERE assigned_to = $1
        AND resolved_at IS NOT NULL
        AND resolved_at >= NOW() - INTERVAL '30 days'`,
    [userId]
  );

  const b = buckets.rows[0];
  const open_active = b.open_c + b.in_progress;
  const sla_pct = open_active
    ? Math.max(0, Math.round(((open_active - breach.rows[0].breached) / open_active) * 100))
    : 100;

  return {
    counts: {
      total:         b.total,
      open:          b.open_c,
      in_progress:   b.in_progress,
      resolved:      b.resolved,
      high_open:     b.high_open,
      overdue_24h:   b.overdue_24h,
      resolved_7d:   b.resolved_7d,
      sla_breached:  breach.rows[0].breached,
    },
    sla: {
      pct: sla_pct,
      avg_resolution_hours: Number(avgRes.rows[0].avg_hours.toFixed(2)),
      resolved_30d: avgRes.rows[0].n,
      target_hours_by_priority: SLA_HOURS_BY_PRIORITY,
    },
  };
};

// Priority queue — ordered by priority (high first) then SLA urgency (oldest first)
exports.myTicketsQueue = async (userId, { status, limit = 30 } = {}) => {
  const params = [userId];
  let where = `t.assigned_to = $1 AND t.status IN ('open','in_progress')`;
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
  params.push(Number(limit));
  const { rows } = await query(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
            c.name AS contact_name, c.email AS contact_email,
            (SELECT COUNT(*)::int FROM ticket_comments tc WHERE tc.ticket_id = t.id) AS comment_count
       FROM tickets t
       LEFT JOIN contacts c ON c.id = t.contact_id
      WHERE ${where}
      ORDER BY
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.created_at ASC
      LIMIT $${params.length}`,
    params
  );
  return rows.map(withSla);
};

// Recent ticket activity — logs touching tickets I'm involved with
exports.myTicketsActivity = async (userId, { limit = 10 } = {}) => {
  const { rows } = await query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.meta, l.created_at,
            u.name AS user_name, u.email AS user_email,
            t.subject AS ticket_subject, t.priority AS ticket_priority, t.status AS ticket_status
       FROM logs l
       LEFT JOIN users u   ON u.id = l.user_id
       LEFT JOIN tickets t ON t.id = l.entity_id AND l.entity = 'ticket'
      WHERE l.entity = 'ticket'
        AND (
              l.user_id = $1
           OR t.assigned_to = $1
        )
      ORDER BY l.created_at DESC
      LIMIT $2`,
    [userId, Number(limit)]
  );
  return rows;
};

// ===========================================================================
// SALES DASHBOARD — per-user (scoped to a single userId)
// ===========================================================================

// My KPIs + 7-day vs prev-7 trend, all scoped to current user
exports.myDashboard = async (userId) => {
  const [leads, dealsAll, dealsWon, tasks, leadsTrend, dealsTrend] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c,
                  COUNT(*) FILTER (WHERE status NOT IN ('converted','lost'))::int AS active
             FROM leads WHERE assigned_to = $1`, [userId]),
    query(`SELECT COUNT(*)::int AS c, COALESCE(SUM(value),0)::float AS v
             FROM deals WHERE owner_id = $1`, [userId]),
    query(`SELECT COALESCE(SUM(d.value),0)::float AS won
             FROM deals d
             LEFT JOIN pipeline_stages s ON s.id = d.stage_id
            WHERE d.owner_id = $1 AND LOWER(s.name) = 'won'`, [userId]),
    query(`SELECT COUNT(*)::int AS c,
                  COUNT(*) FILTER (WHERE status='pending')::int AS pending,
                  COUNT(*) FILTER (WHERE status<>'completed' AND due_date < NOW())::int AS overdue
             FROM tasks WHERE assigned_to = $1`, [userId]),
    query(`SELECT
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS this_period,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days'
                              AND created_at <  NOW() - INTERVAL '7 days')::int     AS prev_period
             FROM leads WHERE assigned_to = $1`, [userId]),
    query(`SELECT
             COALESCE(SUM(value) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),0)::float  AS this_period,
             COALESCE(SUM(value) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days'
                                          AND created_at <  NOW() - INTERVAL '7 days'),0)::float    AS prev_period
             FROM deals WHERE owner_id = $1`, [userId]),
  ]);

  const pct = (cur, prev) => {
    if (!prev) return cur ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  return {
    leads:  { total: leads.rows[0].c, active: leads.rows[0].active },
    deals:  { count: dealsAll.rows[0].c, value: dealsAll.rows[0].v, won_value: dealsWon.rows[0].won },
    tasks:  { total: tasks.rows[0].c, pending: tasks.rows[0].pending, overdue: tasks.rows[0].overdue },
    trends: {
      leads: { ...leadsTrend.rows[0], change_pct: pct(leadsTrend.rows[0].this_period, leadsTrend.rows[0].prev_period) },
      deals: { ...dealsTrend.rows[0], change_pct: pct(dealsTrend.rows[0].this_period, dealsTrend.rows[0].prev_period) },
    },
  };
};

// Mini Kanban: deals owned by user, grouped by stage (with up to N deals per column)
exports.myPipeline = async (userId, { perStage = 5 } = {}) => {
  const { rows: stages } = await query(
    `SELECT s.id, s.name, s.color, s.position,
            COUNT(d.id) FILTER (WHERE d.owner_id = $1)::int                              AS deal_count,
            COALESCE(SUM(d.value) FILTER (WHERE d.owner_id = $1), 0)::float              AS total_value
       FROM pipeline_stages s
       LEFT JOIN deals d ON d.stage_id = s.id
      GROUP BY s.id
      ORDER BY s.position ASC`,
    [userId]
  );

  // Fetch up to N deals per stage for this user
  const { rows: deals } = await query(
    `SELECT d.id, d.title, d.value, d.stage_id, d.expected_close_date, d.updated_at,
            c.name AS contact_name
       FROM (
         SELECT d.*, ROW_NUMBER() OVER (PARTITION BY d.stage_id ORDER BY d.updated_at DESC) AS rn
           FROM deals d
          WHERE d.owner_id = $1
       ) d
       LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.rn <= $2
      ORDER BY d.stage_id, d.rn`,
    [userId, Number(perStage)]
  );

  // Attach deals onto their stage
  const byStage = {};
  for (const d of deals) {
    (byStage[d.stage_id] = byStage[d.stage_id] || []).push(d);
  }
  return stages.map((s) => ({ ...s, deals: byStage[s.id] || [] }));
};

// Today's tasks: assigned to user, grouped into overdue / today / upcoming
exports.myTasks = async (userId, { upcomingDays = 7 } = {}) => {
  const { rows } = await query(
    `SELECT t.id, t.title, t.priority, t.status, t.due_date,
            t.related_type, t.related_id
       FROM tasks t
      WHERE t.assigned_to = $1
        AND t.status <> 'completed'
      ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`,
    [userId]
  );
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday   = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1);
  const upcomingEnd  = new Date(startOfToday); upcomingEnd.setDate(upcomingEnd.getDate() + Number(upcomingDays));

  const overdue = [], today = [], upcoming = [];
  for (const t of rows) {
    if (!t.due_date) { upcoming.push(t); continue; }
    const d = new Date(t.due_date);
    if (d < startOfToday)             overdue.push(t);
    else if (d < endOfToday)          today.push(t);
    else if (d < upcomingEnd)         upcoming.push(t);
  }
  return { overdue, today, upcoming };
};

// "What should I do next?" — smart suggestions
// New callers should use `/next-actions` (powered by services/nextActions.service.js).
// This endpoint is kept for the existing Sales dashboard payload shape.
exports.myNextActions = async (userId) => {
  const [leadsToCall, stuckDeals, followUpsDue] = await Promise.all([
    // Leads not contacted in 2+ days (status still "new"/"contacted")
    query(
      `SELECT l.id, l.name, l.company, l.email, l.phone, l.status, l.value, l.updated_at
         FROM leads l
        WHERE l.assigned_to = $1
          AND l.status IN ('new','contacted')
          AND l.updated_at < NOW() - INTERVAL '2 days'
        ORDER BY l.updated_at ASC
        LIMIT 5`,
      [userId]
    ),
    // Deals inactive for 5+ days, not in won/lost
    query(
      `SELECT d.id, d.title, d.value, d.updated_at,
              s.name AS stage_name, c.name AS contact_name
         FROM deals d
         LEFT JOIN pipeline_stages s ON s.id = d.stage_id
         LEFT JOIN contacts c ON c.id = d.contact_id
        WHERE d.owner_id = $1
          AND d.updated_at < NOW() - INTERVAL '5 days'
          AND (s.name IS NULL OR LOWER(s.name) NOT IN ('won','lost','closed won','closed lost'))
        ORDER BY d.updated_at ASC
        LIMIT 5`,
      [userId]
    ),
    // Follow-ups: tasks due in next 24h or overdue
    query(
      `SELECT t.id, t.title, t.priority, t.due_date, t.status
         FROM tasks t
        WHERE t.assigned_to = $1
          AND t.status <> 'completed'
          AND t.due_date IS NOT NULL
          AND t.due_date < NOW() + INTERVAL '1 day'
        ORDER BY t.due_date ASC
        LIMIT 5`,
      [userId]
    ),
  ]);
  return {
    leads_to_call:   leadsToCall.rows,
    stuck_deals:     stuckDeals.rows,
    follow_ups_due:  followUpsDue.rows,
    counts: {
      leads_to_call:  leadsToCall.rows.length,
      stuck_deals:    stuckDeals.rows.length,
      follow_ups_due: followUpsDue.rows.length,
    },
  };
};

// Activity by/about the current user
exports.myActivity = async (userId, { limit = 10 } = {}) => {
  const { rows } = await query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.meta, l.created_at,
            u.name AS user_name, u.email AS user_email
       FROM logs l
       LEFT JOIN users u ON u.id = l.user_id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2`,
    [userId, Number(limit)]
  );
  return rows;
};

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD: Alerts
//   - Overdue tasks (past due_date, not completed)
//   - High-priority open tickets
//   - "Stuck" deals: not updated in >7 days, not in won/lost stage
// ---------------------------------------------------------------------------
/**
 * Smart-dashboard alert payload.
 *
 * Each list is capped at 5 — a "you should look here first" surface, not a
 * full table. Counts let the UI badge the tabs even when the list is empty.
 *
 * Tickets nearing SLA breach uses the same window as the SLA cron's WARN
 * pass (default 60 minutes) so the dashboard and the cron are looking at
 * the same set of "danger zone" tickets.
 */
exports.alerts = async () => {
  const NEAR_SLA_MINUTES = Number(process.env.SLA_WARN_MINUTES || 60);

  const [overdueTasks, highPriTickets, stuckDeals, nearSlaTickets] = await Promise.all([
    query(
      `SELECT t.id, t.title, t.due_date, t.priority, t.status,
              u.name AS assigned_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.status <> 'completed'
          AND t.due_date IS NOT NULL
          AND t.due_date < NOW()
        ORDER BY t.due_date ASC
        LIMIT 5`
    ),
    query(
      `SELECT t.id, t.ticket_no, t.subject, t.priority, t.status, t.created_at,
              u.name AS assigned_name
         FROM tickets t
         LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.status IN ('open','in_progress')
          AND t.priority IN ('high','critical')
        ORDER BY t.created_at ASC
        LIMIT 5`
    ),
    query(
      `SELECT d.id, d.title, d.value, d.updated_at,
              s.name AS stage_name,
              u.name AS owner_name
         FROM deals d
         LEFT JOIN pipeline_stages s ON s.id = d.stage_id
         LEFT JOIN users u            ON u.id = d.owner_id
        WHERE d.updated_at < NOW() - INTERVAL '7 days'
          AND (s.name IS NULL OR LOWER(s.name) NOT IN ('won','lost','closed won','closed lost'))
        ORDER BY d.updated_at ASC
        LIMIT 5`
    ),
    query(
      `SELECT t.id, t.ticket_no, t.subject, t.priority, t.sla_due_at,
              t.escalation_level,
              u.name AS engineer_name,
              EXTRACT(EPOCH FROM (t.sla_due_at - NOW()))/60 AS remaining_minutes
         FROM tickets t
         LEFT JOIN users u ON u.id = t.assigned_engineer_id
        WHERE t.status NOT IN ('closed','resolved')
          AND t.sla_paused_at IS NULL
          AND t.sla_due_at IS NOT NULL
          AND t.sla_due_at > NOW()
          AND t.sla_due_at <= NOW() + ($1 || ' minutes')::interval
        ORDER BY t.sla_due_at ASC
        LIMIT 5`,
      [NEAR_SLA_MINUTES]
    ),
  ]);

  return {
    overdue_tasks:          overdueTasks.rows,
    high_priority_tickets:  highPriTickets.rows,
    stuck_deals:            stuckDeals.rows,
    near_sla_tickets:       nearSlaTickets.rows,
    counts: {
      overdue_tasks:         overdueTasks.rows.length,
      high_priority_tickets: highPriTickets.rows.length,
      stuck_deals:           stuckDeals.rows.length,
      near_sla_tickets:      nearSlaTickets.rows.length,
    },
  };
};
