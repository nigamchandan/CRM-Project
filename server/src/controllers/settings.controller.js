const service = require('../services/settings.service');
const sla     = require('../services/sla.service');

exports.getAll  = async (req, res, next) => { try { res.json(await service.getAll());                     } catch (e) { next(e); } };
exports.upsert  = async (req, res, next) => { try { res.json(await service.upsert(req.body || {}));       } catch (e) { next(e); } };

// SLA — dedicated endpoints (preferred over generic settings PUT for this UI tab)
exports.getSla  = async (req, res, next) => { try { res.json(await sla.getPolicy({ fresh: true }));       } catch (e) { next(e); } };
exports.setSla  = async (req, res, next) => { try { res.json(await sla.setPolicy(req.body || {}));        } catch (e) { next(e); } };

// Email-notify toggles
exports.getEmail = async (req, res, next) => {
  try {
    const all = await service.getAll();
    res.json(all['email.notify'] || {
      ticket_created: true, ticket_closed: true,
      from_name: 'CRM Support', from_email: 'no-reply@crm.test',
    });
  } catch (e) { next(e); }
};
exports.setEmail = async (req, res, next) => {
  try {
    const next_ = req.body || {};
    const all = await service.upsert({ 'email.notify': next_ });
    res.json(all['email.notify']);
  } catch (e) { next(e); }
};
