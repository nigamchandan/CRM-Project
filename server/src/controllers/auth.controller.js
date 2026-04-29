const service = require('../services/auth.service');
const { writeLog } = require('../middleware/audit');

exports.register = async (req, res, next) => {
  try {
    const result = await service.register(req.body);
    await writeLog({ req, userId: result.user.id, action: 'auth.register', entity: 'users', entityId: result.user.id });
    res.status(201).json(result);
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const result = await service.login(req.body);
    await writeLog({ req, userId: result.user.id, action: 'auth.login', entity: 'users', entityId: result.user.id });
    res.json(result);
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await service.getById(req.user.id);
    res.json(user);
  } catch (err) { next(err); }
};

exports.logout = async (req, res) => {
  await writeLog({ req, userId: req.user.id, action: 'auth.logout' });
  res.json({ message: 'Logged out' });
};

exports.updateMe = async (req, res, next) => {
  try {
    const before = await service.getById(req.user.id);
    const updated = await service.updateProfile(req.user.id, req.body);
    const changed = {};
    if (before?.name  !== updated.name)  changed.name  = { from: before?.name,  to: updated.name };
    if (before?.email !== updated.email) changed.email = { from: before?.email, to: updated.email };
    if (Object.keys(changed).length) {
      await writeLog({
        req,
        userId:   req.user.id,
        action:   'profile.update',
        entity:   'users',
        entityId: req.user.id,
        meta:     changed,
        before:   { name: before?.name,  email: before?.email  },
        after:    { name: updated.name,  email: updated.email  },
      });
    }
    res.json(updated);
  } catch (err) { next(err); }
};

exports.changeMyPassword = async (req, res, next) => {
  try {
    await service.changePassword(req.user.id, req.body);
    await writeLog({
      req,
      userId:   req.user.id,
      action:   'profile.password_change',
      entity:   'users',
      entityId: req.user.id,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};
