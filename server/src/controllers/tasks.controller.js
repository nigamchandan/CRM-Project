const service = require('../services/tasks.service');
const notifications = require('../services/notifications.service');
const { writeLog } = require('../middleware/audit');
const { emitBroadcast } = require('../config/socket');

exports.list = async (req, res, next) => {
  try {
    res.json(await service.list({
      ...req.query,
      currentUserId: req.user.id,
      currentUser:   req.user,
    }));
  } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try {
    const r = await service.getById(req.params.id, req.user);
    if (!r) return res.status(404).json({ message: 'Task not found' });
    res.json(r);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const r = await service.create({ ...req.body, created_by: req.user.id });
    await writeLog({ userId: req.user.id, action: 'task.create', entity: 'tasks', entityId: r.id });
    emitBroadcast('task:update', { kind: 'create', task: r });
    if (r.assigned_to && r.assigned_to !== req.user.id) {
      await notifications.createAndEmit({
        user_id: r.assigned_to, type: 'task.assigned',
        title: 'Task assigned', message: `Task: ${r.title}`,
        link: `/tasks`,
      });
    }
    res.status(201).json(r);
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try {
    const existing = await service.getById(req.params.id, req.user);
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    const r = await service.update(req.params.id, req.body);
    await writeLog({ userId: req.user.id, action: 'task.update', entity: 'tasks', entityId: r.id });
    emitBroadcast('task:update', { kind: 'update', task: r });
    res.json(r);
  } catch (e) { next(e); }
};
exports.complete = async (req, res, next) => {
  try {
    const existing = await service.getById(req.params.id, req.user);
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    const r = await service.complete(req.params.id, req.body.completed !== false);
    await writeLog({ userId: req.user.id, action: 'task.complete', entity: 'tasks', entityId: r.id, meta: { completed: r.status === 'completed' } });
    emitBroadcast('task:update', { kind: 'complete', task: r });
    res.json(r);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    const existing = await service.getById(req.params.id, req.user);
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    await service.remove(req.params.id);
    await writeLog({ userId: req.user.id, action: 'task.delete', entity: 'tasks', entityId: req.params.id });
    emitBroadcast('task:update', { kind: 'delete', task: { id: Number(req.params.id) } });
    res.status(204).end();
  } catch (e) { next(e); }
};
