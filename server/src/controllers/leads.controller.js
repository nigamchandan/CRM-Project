const service = require('../services/leads.service');
const notifications = require('../services/notifications.service');
const { writeLog } = require('../middleware/audit');
const { emitBroadcast } = require('../config/socket');

// Compact, diff-friendly snapshot of a lead. Only the fields a reviewer cares
// about — drops timestamps and joined display names that change every save.
function pickLeadFields(l) {
  if (!l) return null;
  return {
    name: l.name, email: l.email, phone: l.phone, company: l.company,
    source: l.source, status: l.status, value: l.value, notes: l.notes,
    assigned_to: l.assigned_to,
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
    const row = await service.create(req.body);
    await writeLog({ req, userId: req.user.id, action: 'lead.create', entity: 'leads', entityId: row.id });
    emitBroadcast('lead:new', row);
    if (row.assigned_to) {
      await notifications.createAndEmit({
        user_id: row.assigned_to, type: 'lead.new',
        title: 'New lead assigned', message: `Lead "${row.name}" has been assigned to you.`,
        link: `/leads/${row.id}`,
      });
    }
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
      action:   'lead.update',
      entity:   'leads',
      entityId: row.id,
      before:   pickLeadFields(before),
      after:    pickLeadFields(row),
    });
    emitBroadcast('lead:update', row);
    res.json(row);
  } catch (e) { next(e); }
};
exports.assign = async (req, res, next) => {
  try {
    const row = await service.assign(req.params.id, req.body.user_id);
    await writeLog({ req, userId: req.user.id, action: 'lead.assign', entity: 'leads', entityId: row.id, meta: { user_id: row.assigned_to } });
    emitBroadcast('lead:update', row);
    if (row.assigned_to) {
      await notifications.createAndEmit({
        user_id: row.assigned_to, type: 'lead.assigned',
        title: 'Lead assigned to you', message: `Lead "${row.name}" has been assigned to you.`,
        link: `/leads/${row.id}`,
      });
    }
    res.json(row);
  } catch (e) { next(e); }
};
exports.setStatus = async (req, res, next) => {
  try {
    const row = await service.setStatus(req.params.id, req.body.status);
    await writeLog({ req, userId: req.user.id, action: 'lead.status', entity: 'leads', entityId: row.id, meta: { status: row.status } });
    emitBroadcast('lead:update', row);
    res.json(row);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    await writeLog({ req, userId: req.user.id, action: 'lead.delete', entity: 'leads', entityId: req.params.id });
    emitBroadcast('lead:delete', { id: Number(req.params.id) });
    res.status(204).end();
  } catch (e) { next(e); }
};
