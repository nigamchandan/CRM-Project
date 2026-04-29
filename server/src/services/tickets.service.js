const { query } = require('../config/db');
const sla = require('./sla.service');

/**
 * Rich SELECT used by all read endpoints — single round-trip JOIN that gives
 * the email service / UI everything it needs to display a ticket.
 *
 * NOTE on project manager:
 *   tickets.project_manager_id is an *override* set on the ticket itself.
 *   projects.project_manager_id is the project default.
 *   We expose `project_manager_id` / `_name` / `_email` as the COALESCED
 *   "effective" PM (override → project default).
 */
const BASE = `
  SELECT t.*,
         a.name  AS assigned_name,
         a.email AS assigned_email,
         eng.name  AS engineer_name,
         eng.email AS engineer_email,
         mgr.name  AS reporting_manager_name,
         mgr.email AS reporting_manager_email,
         creator.name  AS creator_name,
         creator.email AS creator_email,
         loc.name AS location_name,
         loc.code AS location_code,
         tm.name  AS team_name,
         p.name   AS project_name,
         p.code   AS project_code,
         p.customer       AS customer_name,
         p.customer_email AS customer_email,
         p.customer_phone AS customer_phone,
         t.project_manager_id  AS project_manager_override_id,
         tpm.name  AS project_manager_override_name,
         ppm.name  AS project_default_pm_name,
         COALESCE(tpm.id,    ppm.id)    AS project_manager_id,
         COALESCE(tpm.name,  ppm.name)  AS project_manager_name,
         COALESCE(tpm.email, ppm.email) AS project_manager_email,
         con.name  AS contact_name,
         con.email AS contact_email,
         tp.name   AS pipeline_name,
         tp.is_default AS pipeline_is_default,
         ts.name   AS stage_name,
         ts.position AS stage_position,
         ts.color    AS stage_color,
         ts.status_category AS stage_status_category,
         ts.is_closed_state AS stage_is_closed,
         ts.is_sla_paused   AS stage_is_sla_paused
    FROM tickets t
    LEFT JOIN users    a       ON a.id       = t.assigned_to
    LEFT JOIN users    eng     ON eng.id     = t.assigned_engineer_id
    LEFT JOIN users    mgr     ON mgr.id     = t.reporting_manager_id
    LEFT JOIN users    creator ON creator.id = t.created_by
    LEFT JOIN locations loc    ON loc.id     = t.location_id
    LEFT JOIN teams    tm      ON tm.id      = t.team_id
    LEFT JOIN projects p       ON p.id       = t.project_id
    LEFT JOIN users    tpm     ON tpm.id     = t.project_manager_id
    LEFT JOIN users    ppm     ON ppm.id     = p.project_manager_id
    LEFT JOIN contacts con     ON con.id     = t.contact_id
    LEFT JOIN ticket_pipelines       tp ON tp.id = t.pipeline_id
    LEFT JOIN ticket_pipeline_stages ts ON ts.id = t.pipeline_stage_id
`;

/* ---------- helpers ---------- */

/**
 * Role-based row-level scoping for ticket reads.
 *
 * Returns a SQL fragment (already prefixed with " AND (...)") to merge into a
 * WHERE clause, after pushing any required values onto `params`.
 *
 *   admin    → no extra filter (full org access)
 *   manager  → tickets in their team OR tickets they're personally attached to
 *   engineer → only tickets they're personally attached to
 *   user     → same strict scope as engineer (sales rarely touches tickets;
 *              when they do, it's because they raised them for a customer)
 *
 * Pass `null` / no `currentUser` to skip scoping (used for internal post-mutation
 * reloads where access has already been verified by the caller).
 */
function roleScopeWhere(currentUser, params) {
  if (!currentUser || currentUser.role === 'admin') return '';

  const role = currentUser.role;
  const meId = Number(currentUser.id);

  if (role === 'manager') {
    params.push(meId);
    const me = `$${params.length}`;
    if (currentUser.team_id) {
      params.push(Number(currentUser.team_id));
      const team = `$${params.length}`;
      return ` AND (
           t.team_id              = ${team}
        OR t.assigned_engineer_id = ${me}
        OR t.assigned_to          = ${me}
        OR t.reporting_manager_id = ${me}
        OR t.project_manager_id   = ${me}
        OR t.created_by           = ${me}
      )`;
    }
    // Manager without a team — fall back to "personally attached".
    return ` AND (
         t.assigned_engineer_id = ${me}
      OR t.assigned_to          = ${me}
      OR t.reporting_manager_id = ${me}
      OR t.project_manager_id   = ${me}
      OR t.created_by           = ${me}
    )`;
  }

  // engineer + user (sales / general) → strict
  params.push(meId);
  const me = `$${params.length}`;
  return ` AND (
       t.assigned_engineer_id = ${me}
    OR t.assigned_to          = ${me}
    OR t.reporting_manager_id = ${me}
    OR t.project_manager_id   = ${me}
    OR t.created_by           = ${me}
  )`;
}
exports.roleScopeWhere = roleScopeWhere;

async function resolveDefaultPipelineAndStage() {
  const { rows } = await query(
    `SELECT p.id AS pipeline_id, s.id AS stage_id
       FROM ticket_pipelines p
       JOIN ticket_pipeline_stages s ON s.pipeline_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY p.is_default DESC, p.sort_order ASC, s.position ASC
      LIMIT 1`
  );
  return rows[0] || null;
}

async function firstStageOfPipeline(pipelineId) {
  const { rows } = await query(
    `SELECT id FROM ticket_pipeline_stages
      WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1`,
    [pipelineId]
  );
  return rows[0]?.id || null;
}

async function fetchStage(stageId) {
  const { rows } = await query(`SELECT * FROM ticket_pipeline_stages WHERE id = $1`, [stageId]);
  return rows[0] || null;
}

const STAGE_TO_STATUS = {
  open:        'open',
  in_progress: 'in_progress',
  waiting:     'waiting',
  resolved:    'resolved',
  closed:      'closed',
  merged:      'closed',
};

/* ----------------------------------------------------------- LIST + FILTERS */

/**
 * Sort modes — each maps to one column the UI can sort by.
 *   newest / oldest             — t.created_at
 *   updated / updated_asc       — t.updated_at  (HubSpot's "Last activity date")
 *   subject / subject_desc      — t.subject
 *   priority / priority_asc     — urgency rank (critical→low / low→critical)
 *   pipeline / pipeline_desc    — pipeline_name
 *   stage / stage_desc          — stage_position (within pipeline)
 *   owner / owner_desc          — engineer_name (NULLS LAST)
 *   project / project_desc      — project_name  (NULLS LAST)
 *   sla / sla_desc              — t.sla_due_at  (NULLS LAST)
 */
const ORDER_BY = {
  newest:        `t.created_at DESC,
                  CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`,
  oldest:        `t.created_at ASC`,
  priority:      `CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
                  t.created_at DESC`,
  priority_asc:  `CASE t.priority WHEN 'low' THEN 0 WHEN 'medium' THEN 1 WHEN 'high' THEN 2 WHEN 'critical' THEN 3 ELSE 4 END,
                  t.created_at DESC`,
  updated:       `t.updated_at DESC`,
  updated_asc:   `t.updated_at ASC`,
  subject:       `t.subject ASC NULLS LAST`,
  subject_desc:  `t.subject DESC NULLS LAST`,
  pipeline:      `tp.name ASC NULLS LAST, t.created_at DESC`,
  pipeline_desc: `tp.name DESC NULLS LAST, t.created_at DESC`,
  stage:         `ts.position ASC NULLS LAST, t.created_at DESC`,
  stage_desc:    `ts.position DESC NULLS LAST, t.created_at DESC`,
  owner:         `eng.name ASC NULLS LAST`,
  owner_desc:    `eng.name DESC NULLS LAST`,
  project:       `p.name ASC NULLS LAST`,
  project_desc:  `p.name DESC NULLS LAST`,
  sla:           `t.sla_due_at ASC NULLS LAST, t.created_at DESC`,
  sla_desc:      `t.sla_due_at DESC NULLS LAST, t.created_at DESC`,
  id_asc:        `t.id ASC`,
  id_desc:       `t.id DESC`,
  close_date:      `t.closed_at ASC NULLS LAST,  t.created_at DESC`,
  close_date_desc: `t.closed_at DESC NULLS LAST, t.created_at DESC`,
};

exports.list = async ({
  page = 1, limit = 20, status, priority, search = '',
  assigned_to, project_id, location_id, team_id,
  engineer_id, manager_id, source,
  ticket_type,
  pipeline_id, pipeline_stage_id,
  sort = 'newest',
  // Date range filters (ISO strings or YYYY-MM-DD)
  created_after, created_before, updated_after, updated_before,
  closed_after, closed_before,                // close date range filter
  sla_after, sla_before,                      // sla due-date range filter
  min_age_hours, max_age_hours,               // case-age filter (hours since created)
  reporter,                                   // search reporter name OR email
  id: ticketId,                               // exact ticket-number match
  escalated,                                  // boolean — only escalated tickets
  has_sla_breach,                             // boolean — sla_due_at < NOW() and not closed/resolved
  mine, my_team, unassigned, not_closed,
  currentUser,
} = {}) => {
  const offset = (Number(page) - 1) * Number(limit);
  const params = [`%${search}%`];
  let where = `(t.subject ILIKE $1 OR t.description ILIKE $1)`;

  if (status)            { params.push(status);                    where += ` AND t.status = $${params.length}`; }
  if (priority)          { params.push(priority);                  where += ` AND t.priority = $${params.length}`; }
  if (assigned_to)       { params.push(Number(assigned_to));       where += ` AND t.assigned_to = $${params.length}`; }
  if (project_id)        { params.push(Number(project_id));        where += ` AND t.project_id = $${params.length}`; }
  if (location_id)       { params.push(Number(location_id));       where += ` AND t.location_id = $${params.length}`; }
  if (team_id)           { params.push(Number(team_id));           where += ` AND t.team_id = $${params.length}`; }
  if (engineer_id)       { params.push(Number(engineer_id));       where += ` AND t.assigned_engineer_id = $${params.length}`; }
  if (manager_id)        { params.push(Number(manager_id));        where += ` AND t.reporting_manager_id = $${params.length}`; }
  if (source)            { params.push(source);                    where += ` AND t.source = $${params.length}`; }
  if (ticket_type)       { params.push(ticket_type);                where += ` AND t.ticket_type = $${params.length}`; }
  if (pipeline_id)       { params.push(Number(pipeline_id));       where += ` AND t.pipeline_id = $${params.length}`; }
  if (pipeline_stage_id) { params.push(Number(pipeline_stage_id)); where += ` AND t.pipeline_stage_id = $${params.length}`; }
  // Ticket-number quick filter — accepts either the friendly TKT-xxxxx string
  // (substring match), the raw numeric id, or a digit fragment like "12".
  if (ticketId !== undefined && ticketId !== null && String(ticketId).trim() !== '') {
    const raw = String(ticketId).trim().replace(/^#/, '');
    params.push(`%${raw}%`);
    where += ` AND (t.ticket_no ILIKE $${params.length} OR t.id::text ILIKE $${params.length})`;
  }

  if (created_after)     { params.push(created_after);             where += ` AND t.created_at >= $${params.length}::timestamptz`; }
  if (created_before)    { params.push(created_before);            where += ` AND t.created_at <= $${params.length}::timestamptz`; }
  if (updated_after)     { params.push(updated_after);             where += ` AND t.updated_at >= $${params.length}::timestamptz`; }
  if (updated_before)    { params.push(updated_before);            where += ` AND t.updated_at <= $${params.length}::timestamptz`; }
  if (closed_after)      { params.push(closed_after);              where += ` AND t.closed_at >= $${params.length}::timestamptz`; }
  if (closed_before)     { params.push(closed_before);             where += ` AND t.closed_at <= $${params.length}::timestamptz`; }
  if (sla_after)         { params.push(sla_after);                 where += ` AND t.sla_due_at >= $${params.length}::timestamptz`; }
  if (sla_before)        { params.push(sla_before);                where += ` AND t.sla_due_at <= $${params.length}::timestamptz`; }
  if (min_age_hours != null && min_age_hours !== '') {
    params.push(Number(min_age_hours));
    where += ` AND EXTRACT(EPOCH FROM (NOW() - t.created_at))/3600 >= $${params.length}`;
  }
  if (max_age_hours != null && max_age_hours !== '') {
    params.push(Number(max_age_hours));
    where += ` AND EXTRACT(EPOCH FROM (NOW() - t.created_at))/3600 <= $${params.length}`;
  }
  if (reporter) {
    params.push(`%${reporter}%`);
    where += ` AND (t.reporter_name ILIKE $${params.length} OR t.reporter_email ILIKE $${params.length})`;
  }
  if (escalated === true)      { where += ` AND t.escalation_level > 0`; }
  if (has_sla_breach === true) { where += ` AND t.sla_due_at < NOW() AND t.status NOT IN ('closed','resolved')`; }

  // Role-based row-level scope — non-admins never see tickets outside their bubble.
  where += roleScopeWhere(currentUser, params);

  // "My open tickets" — match any relationship the current user has with the ticket:
  // assigned engineer, legacy assigned_to, reporting manager, ticket-level project manager,
  // or the creator. This makes the saved-view useful for non-engineer roles too (admin/manager/PM).
  if (mine === true && currentUser?.id) {
    params.push(Number(currentUser.id));
    const me = `$${params.length}`;
    where += ` AND (
         t.assigned_engineer_id = ${me}
      OR t.assigned_to          = ${me}
      OR t.reporting_manager_id = ${me}
      OR t.project_manager_id   = ${me}
      OR t.created_by           = ${me}
    )`;
  }
  if (my_team === true && currentUser?.team_id) {
    params.push(Number(currentUser.team_id));
    where += ` AND t.team_id = $${params.length}`;
  }
  if (unassigned === true) {
    where += ` AND t.assigned_engineer_id IS NULL AND t.assigned_to IS NULL`;
  }
  if (not_closed === true) {
    where += ` AND t.status NOT IN ('closed','resolved')`;
  }

  const orderBy = ORDER_BY[sort] || ORDER_BY.newest;
  params.push(Number(limit), offset);
  const { rows } = await query(
    `${BASE} WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = await query(
    `SELECT COUNT(*)::int AS c FROM tickets t WHERE ${where}`,
    params.slice(0, params.length - 2)
  );
  return { data: rows, total: total.rows[0].c, page: Number(page), limit: Number(limit) };
};

/**
 * Fetch a single ticket. When `currentUser` is provided the read is scoped
 * by role — a manager outside the team gets `null` (treated as 404 by the
 * controller), an engineer who isn't attached to the ticket gets `null`.
 *
 * Pass `null` (or omit) to bypass scoping — used for post-mutation reloads
 * inside this file after the caller has already verified access.
 */
exports.getById = async (id, currentUser = null) => {
  const params = [id];
  const scope  = roleScopeWhere(currentUser, params);
  const { rows } = await query(`${BASE} WHERE t.id = $1${scope}`, params);
  return rows[0];
};

/* -------------------------------------------------------------------- CREATE
 * Manual assignment — engineer & reporting-manager are picked by the user.
 * SLA due-date is computed from the configurable `sla.policy` setting.
 * If reporting_manager_id is omitted, we default to the engineer's manager_id.
 * If pipeline_id is omitted, we use the active default pipeline + its first stage.
 */

exports.create = async (body) => {
  const {
    subject, description,
    status, priority = 'medium',
    ticket_type = 'incident',                        // ITIL: incident | request
    project_id, source, contact_id,
    reporter_name, reporter_email, reporter_phone,
    location_id: explicitLocation, team_id: explicitTeam,
    assigned_engineer_id, reporting_manager_id,
    project_manager_id,                              // per-ticket PM override
    pipeline_id: bodyPipeline, pipeline_stage_id: bodyStage,
    sla_due_at: explicitDue,
    created_by,
  } = body;

  // Derive location/team/manager from related entities when not supplied
  let location_id = explicitLocation || null;
  let team_id     = explicitTeam     || null;
  let manager_id  = reporting_manager_id || null;

  if (assigned_engineer_id) {
    const { rows: er } = await query(
      `SELECT id, manager_id, location_id, team_id FROM users WHERE id = $1`,
      [assigned_engineer_id]
    );
    if (er[0]) {
      if (!manager_id)  manager_id  = er[0].manager_id;
      if (!location_id) location_id = er[0].location_id;
      if (!team_id)     team_id     = er[0].team_id;
    }
  }
  if (!location_id && project_id) {
    const { rows: pr } = await query(`SELECT location_id FROM projects WHERE id = $1`, [project_id]);
    if (pr[0]?.location_id) location_id = pr[0].location_id;
  }

  // Resolve pipeline + stage
  let pipeline_id       = bodyPipeline       || null;
  let pipeline_stage_id = bodyStage          || null;
  if (!pipeline_id && !pipeline_stage_id) {
    const def = await resolveDefaultPipelineAndStage();
    if (def) { pipeline_id = def.pipeline_id; pipeline_stage_id = def.stage_id; }
  } else if (pipeline_id && !pipeline_stage_id) {
    pipeline_stage_id = await firstStageOfPipeline(pipeline_id);
  } else if (!pipeline_id && pipeline_stage_id) {
    const st = await fetchStage(pipeline_stage_id);
    pipeline_id = st?.pipeline_id || null;
  }

  // Mirror stage.status_category onto status if caller didn't pass one
  let resolvedStatus = status || 'open';
  if (!status && pipeline_stage_id) {
    const st = await fetchStage(pipeline_stage_id);
    if (st?.status_category) resolvedStatus = STAGE_TO_STATUS[st.status_category] || resolvedStatus;
  }

  // Compute SLA due-at when not explicitly provided
  const sla_due_at = explicitDue ? new Date(explicitDue) : await sla.computeDueAt(priority);

  const { rows } = await query(
    `INSERT INTO tickets
        (subject, description, status, priority, ticket_type,
         pipeline_id, pipeline_stage_id,
         project_id, project_manager_id, location_id, team_id,
         assigned_engineer_id, reporting_manager_id,
         assigned_to,                                                 -- mirrors engineer for back-compat
         source, reporter_name, reporter_email, reporter_phone,
         contact_id, created_by, sla_due_at)
     VALUES ($1,$2,$3,$4,$5,
             $6,$7,
             $8,$9,$10,$11,
             $12,$13,
             $12,
             $14,$15,$16,$17,
             $18,$19,$20)
     RETURNING id`,
    [
      subject, description, resolvedStatus, priority, ticket_type,
      pipeline_id, pipeline_stage_id,
      project_id || null, project_manager_id || null, location_id, team_id,
      assigned_engineer_id || null, manager_id,
      source || null, reporter_name || null, reporter_email || null, reporter_phone || null,
      contact_id || null, created_by || null, sla_due_at,
    ]
  );

  return exports.getById(rows[0].id);
};

/* -------------------------------------------------------------------- UPDATE */

exports.update = async (id, body) => {
  const {
    subject, description, priority,
    ticket_type,
    project_id, source,
    reporter_name, reporter_email, reporter_phone,
    location_id, team_id,
    assigned_engineer_id, reporting_manager_id,
    project_manager_id,
    pipeline_id, pipeline_stage_id,
    contact_id,
    sla_due_at,
    recomputeSla,
  } = body;

  let nextDue = sla_due_at === undefined ? null : sla_due_at;
  if (recomputeSla && priority) {
    nextDue = (await sla.computeDueAt(priority)).toISOString();
  }

  const { rows } = await query(
    `UPDATE tickets SET
       subject              = COALESCE($2,subject),
       description          = COALESCE($3,description),
       priority             = COALESCE($4,priority),
       ticket_type          = COALESCE($5,ticket_type),
       project_id           = COALESCE($6,project_id),
       source               = COALESCE($7,source),
       reporter_name        = COALESCE($8,reporter_name),
       reporter_email       = COALESCE($9,reporter_email),
       reporter_phone       = COALESCE($10,reporter_phone),
       location_id          = COALESCE($11,location_id),
       team_id              = COALESCE($12,team_id),
       assigned_engineer_id = COALESCE($13,assigned_engineer_id),
       reporting_manager_id = COALESCE($14,reporting_manager_id),
       assigned_to          = COALESCE($13,assigned_to),
       project_manager_id   = COALESCE($15,project_manager_id),
       pipeline_id          = COALESCE($16,pipeline_id),
       pipeline_stage_id    = COALESCE($17,pipeline_stage_id),
       contact_id           = COALESCE($18,contact_id),
       sla_due_at           = COALESCE($19,sla_due_at),
       updated_at           = NOW()
     WHERE id = $1 RETURNING id`,
    [
      id, subject, description, priority, ticket_type,
      project_id, source,
      reporter_name, reporter_email, reporter_phone,
      location_id, team_id,
      assigned_engineer_id, reporting_manager_id,
      project_manager_id,
      pipeline_id, pipeline_stage_id,
      contact_id, nextDue,
    ]
  );
  if (!rows[0]) return null;
  return exports.getById(id);
};

/* --------------------------------------------------------------- SET STAGE
 *  HubSpot-style: caller picks a stage; we mirror status_category -> status
 *  and run SLA pause / resume bookkeeping using sla_paused_at.
 */

exports.setStage = async (id, stageId) => {
  const stage = await fetchStage(stageId);
  if (!stage) return null;

  const { rows: tr } = await query(
    `SELECT id, status, sla_paused_at, sla_due_at, pipeline_stage_id FROM tickets WHERE id = $1`,
    [id]
  );
  const before = tr[0];
  if (!before) return null;

  // resume — if currently paused and moving to non-paused stage, push due-at forward
  let nextPausedAt = before.sla_paused_at;
  let nextDueAt   = before.sla_due_at;
  if (before.sla_paused_at && !stage.is_sla_paused) {
    if (before.sla_due_at) {
      const pausedFor = Date.now() - new Date(before.sla_paused_at).getTime();
      nextDueAt = new Date(new Date(before.sla_due_at).getTime() + pausedFor);
    }
    nextPausedAt = null;
  }
  // pause — entering a paused stage and not already paused
  if (!before.sla_paused_at && stage.is_sla_paused) {
    nextPausedAt = new Date();
  }

  const newStatus = STAGE_TO_STATUS[stage.status_category] || before.status;
  await query(
    `UPDATE tickets SET
        pipeline_stage_id = $2,
        pipeline_id       = $3,
        status            = $4::varchar,
        sla_paused_at     = $5::timestamptz,
        sla_due_at        = $6::timestamptz,
        resolved_at       = CASE WHEN $4::varchar IN ('resolved','closed') THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END,
        closed_at         = CASE WHEN $4::varchar = 'closed' THEN COALESCE(closed_at, NOW()) ELSE closed_at END,
        updated_at        = NOW()
     WHERE id = $1`,
    [id, stage.id, stage.pipeline_id, newStatus, nextPausedAt, nextDueAt]
  );
  return exports.getById(id);
};

/* --------------------------------------------------------------- SET STATUS
 *  Legacy direct-status setter kept for back-compat. Internally we still let
 *  SET STAGE be the preferred path going forward.
 */

exports.setStatus = async (id, status) => {
  await query(
    `UPDATE tickets SET
       status      = $2,
       resolved_at = CASE WHEN $2 IN ('resolved','closed') THEN COALESCE(resolved_at, NOW()) ELSE NULL END,
       closed_at   = CASE WHEN $2 = 'closed'              THEN COALESCE(closed_at,   NOW()) ELSE closed_at END,
       updated_at  = NOW()
     WHERE id = $1`,
    [id, status]
  );
  return exports.getById(id);
};

/* --------------------------------------------------------------------- ASSIGN
 * Manual assignment (engineer + optional reporting manager).
 * Backwards-compatible: still accepts plain { user_id } payload.            */

exports.assign = async (id, payload) => {
  const engineerId = payload.assigned_engineer_id ?? payload.user_id ?? null;
  let managerId    = payload.reporting_manager_id ?? null;

  if (engineerId && !managerId) {
    const { rows } = await query(`SELECT manager_id FROM users WHERE id = $1`, [engineerId]);
    managerId = rows[0]?.manager_id || null;
  }

  await query(
    `UPDATE tickets SET
        assigned_engineer_id = $2,
        reporting_manager_id = COALESCE($3, reporting_manager_id),
        assigned_to          = $2,
        updated_at           = NOW()
     WHERE id = $1`,
    [id, engineerId, managerId]
  );
  return exports.getById(id);
};

/* --------------------------------------------------------------- ESCALATE */

exports.escalate = async (id) => {
  await query(
    `UPDATE tickets SET
        escalation_level = escalation_level + 1,
        escalated_at     = NOW(),
        status           = CASE WHEN status IN ('resolved','closed') THEN status ELSE 'escalated' END,
        updated_at       = NOW()
     WHERE id = $1`,
    [id]
  );
  return exports.getById(id);
};

exports.remove = async (id) => { await query('DELETE FROM tickets WHERE id = $1', [id]); };

/* ------------------------------------------------------------ COMMENTS -----
 *  Two flavours of comment live in the same table:
 *    - is_internal=true  → "internal note", visible only to staff
 *      (admin / manager / engineer / user). Used for triage chatter,
 *      links to runbooks, root-cause discussion.
 *    - is_internal=false → customer-visible reply. Eventually rendered in
 *      a customer portal / outbound email; today it's the public timeline.
 *
 *  The viewer's role gates visibility. Engineers/managers/admins see both;
 *  any future "customer" / "external" role would only see public ones.
 *  We deliberately scope at the service layer so every read-path inherits
 *  the rule for free.
 */

const STAFF_ROLES = new Set(['admin', 'manager', 'engineer', 'user']);

exports.listComments = async (ticketId, currentUser = null) => {
  // Staff see everything; external viewers only see public replies.
  // (No external role today; this is forward-compatible with a portal.)
  const includeInternal = !currentUser || STAFF_ROLES.has(currentUser.role);
  const where = includeInternal ? '' : 'AND tc.is_internal = FALSE';
  const { rows } = await query(
    `SELECT tc.*, u.name AS author_name, u.email AS author_email, u.role AS author_role
       FROM ticket_comments tc
       LEFT JOIN users u ON u.id = tc.author_id
      WHERE tc.ticket_id = $1 ${where}
      ORDER BY tc.created_at ASC`, [ticketId]
  );
  return rows;
};

exports.addComment = async (ticketId, { author_id, body, attachments = [], is_internal = false }) => {
  const { rows } = await query(
    `INSERT INTO ticket_comments (ticket_id, author_id, body, attachments, is_internal)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [ticketId, author_id, body, JSON.stringify(attachments), Boolean(is_internal)]
  );
  return rows[0];
};
