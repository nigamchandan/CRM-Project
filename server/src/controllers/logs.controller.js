const service = require('../services/logs.service');

exports.list = async (req, res, next) => {
  try { res.json(await service.list(req.query)); } catch (e) { next(e); }
};
