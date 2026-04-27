const service = require('../services/contacts.service');
const { writeLog } = require('../middleware/audit');

exports.list = async (req, res, next) => {
  try { res.json(await service.list(req.query)); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try { res.json(await service.getById(req.params.id)); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try {
    const row = await service.create({ ...req.body, owner_id: req.user.id });
    await writeLog({ userId: req.user.id, action: 'contact.create', entity: 'contacts', entityId: row.id });
    res.status(201).json(row);
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const row = await service.update(req.params.id, req.body);
    await writeLog({ userId: req.user.id, action: 'contact.update', entity: 'contacts', entityId: row.id });
    res.json(row);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    await writeLog({ userId: req.user.id, action: 'contact.delete', entity: 'contacts', entityId: req.params.id });
    res.status(204).end();
  } catch (e) { next(e); }
};
