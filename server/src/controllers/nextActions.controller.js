const service = require('../services/nextActions.service');

exports.list = async (req, res, next) => {
  try {
    const scope = req.query.scope === 'team' ? 'team' : 'mine';
    const data = await service.getForUser(req.user, { scope });
    res.json(data);
  } catch (e) { next(e); }
};
