const service = require('../services/locations.service');

const parseBool = (v) => (v === undefined ? undefined : v === 'true' || v === true);

exports.list = async (req, res, next) => {
  try {
    res.json(await service.list({ q: req.query.q, active: parseBool(req.query.active) }));
  } catch (e) { next(e); }
};
exports.get = async (req, res, next) => {
  try {
    const row = await service.get(req.params.id);
    if (!row) return res.status(404).json({ message: 'Location not found' });
    res.json(row);
  } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).json(await service.create(req.body || {})); } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const row = await service.update(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ message: 'Location not found' });
    res.json(row);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try { await service.remove(req.params.id); res.status(204).end(); } catch (e) { next(e); }
};
