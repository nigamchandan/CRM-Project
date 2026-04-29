const { query } = require('../config/db');

/**
 * Workload-balancing service.
 *
 * Returns one row per active engineer with a load index that combines:
 *   - open_total       : tickets currently assigned and not yet closed/resolved
 *   - high_priority    : open count where priority IN ('high','critical')
 *   - sla_at_risk      : open count where sla_due_at is within the warning
 *                        window (default 60 min) — these are soon-to-fire
 *   - sla_breached     : open count where sla_due_at < NOW()
 *   - load_score       : weighted sum used to rank engineers
 *
 * Weights are intentionally simple so the ordering matches what an admin
 * would intuit: a breached ticket counts more than three normal tickets.
 *
 *   load_score =
 *       1   * open_total
 *     + 0.5 * high_priority
 *     + 1   * sla_at_risk
 *     + 3   * sla_breached
 *
 * Inactive users are excluded. Role filter defaults to 'engineer' but can
 * be expanded (e.g. ['engineer','manager']) if a team also routes work to
 * managers.
 */

const NEAR_SLA_MINUTES = Number(process.env.SLA_WARN_MINUTES || 60);

exports.engineerLoad = async ({
  roles = ['engineer'],
  team_id,
  location_id,
  limit = 50,
} = {}) => {
  const params = [roles];
  let where = `u.role = ANY($1) AND u.is_active = TRUE`;
  if (team_id)     { params.push(Number(team_id));     where += ` AND u.team_id = $${params.length}`; }
  if (location_id) { params.push(Number(location_id)); where += ` AND u.location_id = $${params.length}`; }
  params.push(NEAR_SLA_MINUTES);
  const warnIdx = `$${params.length}`;
  params.push(Number(limit));
  const limitIdx = `$${params.length}`;

  const sql = `
    WITH open_tix AS (
      SELECT t.assigned_engineer_id AS uid,
             COUNT(*)::int                                                            AS open_total,
             COUNT(*) FILTER (WHERE t.priority = 'critical')::int                     AS critical_priority,
             COUNT(*) FILTER (WHERE t.priority = 'high')::int                         AS high_priority_only,
             COUNT(*) FILTER (WHERE t.priority IN ('high','critical'))::int           AS high_priority,
             COUNT(*) FILTER (WHERE t.priority = 'medium')::int                       AS medium_priority,
             COUNT(*) FILTER (WHERE t.priority = 'low')::int                          AS low_priority,
             COUNT(*) FILTER (
               WHERE t.sla_due_at IS NOT NULL
                 AND t.sla_paused_at IS NULL
                 AND t.sla_due_at > NOW()
                 AND t.sla_due_at <= NOW() + (${warnIdx} || ' minutes')::interval
             )::int                                                                   AS sla_at_risk,
             COUNT(*) FILTER (
               WHERE t.sla_due_at IS NOT NULL
                 AND t.sla_paused_at IS NULL
                 AND t.sla_due_at < NOW()
             )::int                                                                   AS sla_breached
        FROM tickets t
       WHERE t.assigned_engineer_id IS NOT NULL
         AND t.status NOT IN ('closed','resolved')
       GROUP BY t.assigned_engineer_id
    )
    SELECT
      u.id, u.name, u.email, u.role, u.team_id, u.location_id,
      tm.name  AS team_name,
      loc.name AS location_name,
      COALESCE(o.open_total, 0)        AS open_total,
      COALESCE(o.critical_priority, 0) AS critical_priority,
      COALESCE(o.high_priority_only,0) AS high_priority_only,
      COALESCE(o.high_priority, 0)     AS high_priority,
      COALESCE(o.medium_priority, 0)   AS medium_priority,
      COALESCE(o.low_priority, 0)      AS low_priority,
      COALESCE(o.sla_at_risk, 0)       AS sla_at_risk,
      COALESCE(o.sla_breached, 0)      AS sla_breached,
      -- Priority-weighted count (critical=4, high=3, medium=2, low=1) — surfaces
      -- "this engineer is buried in critical work" without baking SLA risk in.
      (
        COALESCE(o.critical_priority, 0) * 4
      + COALESCE(o.high_priority_only,0) * 3
      + COALESCE(o.medium_priority, 0)   * 2
      + COALESCE(o.low_priority, 0)      * 1
      )::int AS weighted_count,
      -- load_score adds urgency on top of weighted_count: SLA risk and
      -- breaches push an engineer further down the auto-assign queue.
      (
        COALESCE(o.open_total, 0) * 1.0
      + COALESCE(o.high_priority, 0) * 0.5
      + COALESCE(o.sla_at_risk, 0) * 1.0
      + COALESCE(o.sla_breached, 0) * 3.0
      )::float AS load_score
      FROM users u
      LEFT JOIN open_tix    o   ON o.uid = u.id
      LEFT JOIN teams       tm  ON tm.id = u.team_id
      LEFT JOIN locations   loc ON loc.id = u.location_id
     WHERE ${where}
     ORDER BY load_score ASC, u.name ASC
     LIMIT ${limitIdx}
  `;
  const { rows } = await query(sql, params);
  return rows;
};

/**
 * Pick the single least-loaded engineer (excluding optional `excludeId` —
 * useful when the caller wants "anyone but the current owner"). Falls back
 * to `null` when no engineer matches the filter so the UI can decide what
 * to show.
 */
exports.suggestLeastLoaded = async ({ excludeId, ...filters } = {}) => {
  const all = await exports.engineerLoad({ ...filters, limit: 50 });
  const pool = excludeId ? all.filter((u) => u.id !== Number(excludeId)) : all;
  return pool[0] || null;
};
