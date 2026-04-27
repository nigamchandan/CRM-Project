const { query } = require('../config/db');

/* ============================================================================
 *  TICKET PIPELINES + STAGES
 *  Mirrors HubSpot's pipeline model: every ticket belongs to a pipeline and
 *  sits at exactly one stage. Stages have a status_category (open/in_progress/
 *  waiting/closed/merged) which we mirror onto the legacy `tickets.status`
 *  column for back-compat with existing dashboards.
 * ========================================================================= */

const PIPELINE_BASE = `
  SELECT p.*,
         (SELECT COUNT(*)::int FROM ticket_pipeline_stages s WHERE s.pipeline_id = p.id) AS stage_count,
         (SELECT COUNT(*)::int FROM tickets t WHERE t.pipeline_id = p.id)                AS ticket_count
    FROM ticket_pipelines p
`;

const STAGE_BASE = `
  SELECT s.*,
         (SELECT COUNT(*)::int FROM tickets t WHERE t.pipeline_stage_id = s.id) AS ticket_count
    FROM ticket_pipeline_stages s
`;

/* -------- pipelines -------- */

exports.listPipelines = async ({ active } = {}) => {
  const where = [];
  if (active === true)  where.push('p.is_active = TRUE');
  if (active === false) where.push('p.is_active = FALSE');
  const sql = `${PIPELINE_BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY p.is_default DESC, p.sort_order ASC, p.name ASC`;
  const { rows } = await query(sql);
  return rows;
};

exports.getPipeline = async (id) => {
  const { rows } = await query(`${PIPELINE_BASE} WHERE p.id = $1`, [id]);
  return rows[0] || null;
};

exports.getDefaultPipeline = async () => {
  const { rows } = await query(`${PIPELINE_BASE} WHERE p.is_default = TRUE AND p.is_active = TRUE LIMIT 1`);
  if (rows[0]) return rows[0];
  const fallback = await query(`${PIPELINE_BASE} WHERE p.is_active = TRUE ORDER BY p.sort_order ASC LIMIT 1`);
  return fallback.rows[0] || null;
};

exports.createPipeline = async ({
  name, description, is_default = false, sort_order = 0, is_active = true,
}) => {
  if (is_default) await query(`UPDATE ticket_pipelines SET is_default = FALSE WHERE is_default = TRUE`);
  const { rows } = await query(
    `INSERT INTO ticket_pipelines (name, description, is_default, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, description || null, !!is_default, Number(sort_order) || 0, !!is_active]
  );
  return exports.getPipeline(rows[0].id);
};

exports.updatePipeline = async (id, fields) => {
  if (fields.is_default) {
    await query(`UPDATE ticket_pipelines SET is_default = FALSE WHERE is_default = TRUE AND id <> $1`, [id]);
  }
  const { name, description, is_default, sort_order, is_active } = fields;
  const { rows } = await query(
    `UPDATE ticket_pipelines SET
        name        = COALESCE($2, name),
        description = COALESCE($3, description),
        is_default  = COALESCE($4, is_default),
        sort_order  = COALESCE($5, sort_order),
        is_active   = COALESCE($6, is_active),
        updated_at  = NOW()
      WHERE id = $1 RETURNING id`,
    [id, name, description, is_default, sort_order, is_active]
  );
  if (!rows[0]) return null;
  return exports.getPipeline(id);
};

exports.removePipeline = async (id) => {
  await query('DELETE FROM ticket_pipelines WHERE id = $1', [id]);
};

/* -------- stages -------- */

exports.listStages = async ({ pipeline_id } = {}) => {
  const where = [];
  const params = [];
  if (pipeline_id) { params.push(Number(pipeline_id)); where.push(`s.pipeline_id = $${params.length}`); }
  const sql = `${STAGE_BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY s.pipeline_id ASC, s.position ASC`;
  const { rows } = await query(sql, params);
  return rows;
};

exports.getStage = async (id) => {
  const { rows } = await query(`${STAGE_BASE} WHERE s.id = $1`, [id]);
  return rows[0] || null;
};

exports.createStage = async ({
  pipeline_id, name, position = 0, status_category = 'open',
  color = '#6b7280', is_closed_state = false, is_sla_paused = false,
}) => {
  const { rows } = await query(
    `INSERT INTO ticket_pipeline_stages
        (pipeline_id, name, position, status_category, color, is_closed_state, is_sla_paused)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [pipeline_id, name, Number(position) || 0, status_category, color, !!is_closed_state, !!is_sla_paused]
  );
  return exports.getStage(rows[0].id);
};

exports.updateStage = async (id, fields) => {
  const { name, position, status_category, color, is_closed_state, is_sla_paused } = fields;
  const { rows } = await query(
    `UPDATE ticket_pipeline_stages SET
        name            = COALESCE($2, name),
        position        = COALESCE($3, position),
        status_category = COALESCE($4, status_category),
        color           = COALESCE($5, color),
        is_closed_state = COALESCE($6, is_closed_state),
        is_sla_paused   = COALESCE($7, is_sla_paused),
        updated_at      = NOW()
      WHERE id = $1 RETURNING id`,
    [id, name, position, status_category, color, is_closed_state, is_sla_paused]
  );
  if (!rows[0]) return null;
  return exports.getStage(id);
};

exports.reorderStages = async (pipeline_id, orderedIds) => {
  if (!Array.isArray(orderedIds) || !orderedIds.length) return [];
  for (let i = 0; i < orderedIds.length; i++) {
    await query(
      `UPDATE ticket_pipeline_stages SET position = $1, updated_at = NOW()
       WHERE id = $2 AND pipeline_id = $3`,
      [i + 1, orderedIds[i], pipeline_id]
    );
  }
  return exports.listStages({ pipeline_id });
};

exports.removeStage = async (id) => {
  await query('DELETE FROM ticket_pipeline_stages WHERE id = $1', [id]);
};
