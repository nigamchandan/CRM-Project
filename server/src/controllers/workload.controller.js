const service = require('../services/workload.service');

/**
 * GET /api/workload/engineers
 *   ?team_id=...&location_id=...&roles=engineer,manager
 *
 * Returns one row per matching active engineer with their open ticket load
 * and a derived load_score. Sorted ascending by score so the UI's first
 * row is always the least-loaded option.
 */
exports.engineerLoad = async (req, res, next) => {
  try {
    const roles = req.query.roles
      ? String(req.query.roles).split(',').map((s) => s.trim()).filter(Boolean)
      : ['engineer'];
    const data = await service.engineerLoad({
      roles,
      team_id:     req.query.team_id     || undefined,
      location_id: req.query.location_id || undefined,
      limit:       req.query.limit       || 50,
    });
    res.json(data);
  } catch (e) { next(e); }
};

/**
 * GET /api/workload/suggest
 *   ?team_id=...&location_id=...&exclude_id=12
 *
 * Returns `{ user: { id, name, ... } }` for the least-loaded engineer
 * within the optional team/location scope, or `{ user: null }` when no
 * engineer matches.
 */
exports.suggest = async (req, res, next) => {
  try {
    const user = await service.suggestLeastLoaded({
      team_id:     req.query.team_id     || undefined,
      location_id: req.query.location_id || undefined,
      excludeId:   req.query.exclude_id  || undefined,
    });
    res.json({ user });
  } catch (e) { next(e); }
};
