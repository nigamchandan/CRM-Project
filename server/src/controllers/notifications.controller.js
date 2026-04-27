const service = require('../services/notifications.service');

exports.list = async (req, res, next) => {
  try { res.json(await service.listForUser(req.user.id, req.query)); } catch (e) { next(e); }
};
exports.markRead = async (req, res, next) => {
  try { res.json(await service.markRead(req.params.id, req.user.id)); } catch (e) { next(e); }
};
exports.markAllRead = async (req, res, next) => {
  try { res.json(await service.markAllRead(req.user.id)); } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try { await service.remove(req.params.id, req.user.id); res.status(204).end(); } catch (e) { next(e); }
};
