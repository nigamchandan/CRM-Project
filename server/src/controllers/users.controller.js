const service = require('../services/users.service');
const { writeLog } = require('../middleware/audit');

exports.list = async (req, res, next) => {
  try { res.json(await service.list(req.query)); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try { res.json(await service.getById(req.params.id)); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try {
    const u = await service.create(req.body);
    await writeLog({ userId: req.user.id, action: 'user.create', entity: 'users', entityId: u.id });
    res.status(201).json(u);
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const u = await service.update(req.params.id, req.body);
    await writeLog({ userId: req.user.id, action: 'user.update', entity: 'users', entityId: u.id });
    res.json(u);
  } catch (e) { next(e); }
};
exports.toggleStatus = async (req, res, next) => {
  try {
    const u = await service.setActive(req.params.id, req.body.is_active);
    await writeLog({ userId: req.user.id, action: 'user.toggle_status', entity: 'users', entityId: u.id, meta: { is_active: u.is_active } });
    res.json(u);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    await writeLog({ userId: req.user.id, action: 'user.delete', entity: 'users', entityId: req.params.id });
    res.status(204).end();
  } catch (e) { next(e); }
};
