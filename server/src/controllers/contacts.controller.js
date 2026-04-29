const service = require('../services/contacts.service');
const { writeLog } = require('../middleware/audit');

function pickContactFields(c) {
  if (!c) return null;
  return {
    name: c.name, email: c.email, phone: c.phone, company: c.company,
    title: c.title, notes: c.notes, owner_id: c.owner_id,
  };
}

exports.list = async (req, res, next) => {
  try { res.json(await service.list(req.query)); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try { res.json(await service.getById(req.params.id)); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try {
    const row = await service.create({ ...req.body, owner_id: req.user.id });
    await writeLog({ req, userId: req.user.id, action: 'contact.create', entity: 'contacts', entityId: row.id });
    res.status(201).json(row);
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const before = await service.getById(req.params.id);
    const row    = await service.update(req.params.id, req.body);
    await writeLog({
      req,
      userId:   req.user.id,
      action:   'contact.update',
      entity:   'contacts',
      entityId: row.id,
      before:   pickContactFields(before),
      after:    pickContactFields(row),
    });
    res.json(row);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    await writeLog({ req, userId: req.user.id, action: 'contact.delete', entity: 'contacts', entityId: req.params.id });
    res.status(204).end();
  } catch (e) { next(e); }
};
