const service = require('../services/deals.service');
const { writeLog } = require('../middleware/audit');
const { emitBroadcast } = require('../config/socket');

exports.list = async (req, res, next) => { try { res.json(await service.list(req.query)); } catch (e) { next(e); } };
exports.board = async (req, res, next) => { try { res.json(await service.board()); } catch (e) { next(e); } };
exports.getOne = async (req, res, next) => { try { res.json(await service.getById(req.params.id)); } catch (e) { next(e); } };

exports.create = async (req, res, next) => {
  try {
    const r = await service.create({ ...req.body, owner_id: req.body.owner_id || req.user.id });
    await writeLog({ userId: req.user.id, action: 'deal.create', entity: 'deals', entityId: r.id });
    emitBroadcast('deal:new', r);
    res.status(201).json(r);
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const r = await service.update(req.params.id, req.body);
    await writeLog({ userId: req.user.id, action: 'deal.update', entity: 'deals', entityId: r.id });
    emitBroadcast('deal:update', r);
    res.json(r);
  } catch (e) { next(e); }
};
exports.moveStage = async (req, res, next) => {
  try {
    const r = await service.moveStage(req.params.id, req.body.stage_id, req.body.position);
    await writeLog({ userId: req.user.id, action: 'deal.move_stage', entity: 'deals', entityId: r.id, meta: { stage_id: r.stage_id } });
    emitBroadcast('deal:update', r);
    res.json(r);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    await writeLog({ userId: req.user.id, action: 'deal.delete', entity: 'deals', entityId: req.params.id });
    emitBroadcast('deal:delete', { id: Number(req.params.id) });
    res.status(204).end();
  } catch (e) { next(e); }
};
