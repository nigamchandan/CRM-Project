const service       = require('../services/tickets.service');
const notifications = require('../services/notifications.service');
const email         = require('../services/email.service');
const logsService   = require('../services/logs.service');
const { writeLog }  = require('../middleware/audit');
const { emitBroadcast } = require('../config/socket');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const parseBool  = (v) => (v === undefined ? undefined : v === 'true' || v === true);

/* ----------------------------------------------------------- READ endpoints */

exports.list = async (req, res, next) => {
  try {
    res.json(await service.list({
      ...req.query,
      mine:           parseBool(req.query.mine),
      my_team:        parseBool(req.query.my_team),
      unassigned:     parseBool(req.query.unassigned),
      not_closed:     parseBool(req.query.not_closed),
      escalated:      parseBool(req.query.escalated),
      has_sla_breach: parseBool(req.query.has_sla_breach),
      currentUser:    req.user,
    }));
  } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try {
    const r = await service.getById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Ticket not found' });
    res.json(r);
  } catch (e) { next(e); }
};

/* --------------------------------------------------------------- CREATE */

exports.create = async (req, res, next) => {
  try {
    const r = await service.create({ ...req.body, created_by: req.user.id });
    await writeLog({ userId: req.user.id, action: 'ticket.create', entity: 'tickets', entityId: r.id });
    emitBroadcast('ticket:new', r);

    // Notify engineer in-app
    const friendlyNo = r.ticket_no || `#${r.id}`;
    if (r.assigned_engineer_id) {
      await notifications.createAndEmit({
        user_id: r.assigned_engineer_id, type: 'ticket.new',
        title: 'New ticket assigned', message: `Ticket ${friendlyNo}: ${r.subject}`,
        link:  `/tickets/${r.id}`,
      });
    }
    // Notify project manager in-app
    if (r.project_manager_id && r.project_manager_id !== r.assigned_engineer_id) {
      await notifications.createAndEmit({
        user_id: r.project_manager_id, type: 'ticket.new',
        title: `New ticket on ${r.project_name || 'your project'}`,
        message: `Ticket ${friendlyNo}: ${r.subject}`,
        link: `/tickets/${r.id}`,
      });
    }

    // Fire-and-forget email
    email.sendTicketCreated(r, { clientUrl: CLIENT_URL })
      .catch((err) => console.error('[email] ticket.created failed:', err.message));

    res.status(201).json(r);
  } catch (e) { next(e); }
};

/* --------------------------------------------------------------- UPDATE */

exports.update = async (req, res, next) => {
  try {
    const r = await service.update(req.params.id, req.body);
    if (!r) return res.status(404).json({ message: 'Ticket not found' });
    await writeLog({ userId: req.user.id, action: 'ticket.update', entity: 'tickets', entityId: r.id });
    emitBroadcast('ticket:update', r);
    res.json(r);
  } catch (e) { next(e); }
};

/* ---------------------------------------------------------- SET STAGE
 *  HubSpot-style stage move. Mirrors the new status onto t.status and
 *  takes care of SLA pause/resume bookkeeping inside the service.
 */

exports.setStage = async (req, res, next) => {
  try {
    const stageId = req.body.pipeline_stage_id || req.body.stage_id;
    if (!stageId) return res.status(400).json({ message: 'pipeline_stage_id is required' });
    const before = await service.getById(req.params.id);
    const r = await service.setStage(req.params.id, stageId);
    if (!r) return res.status(404).json({ message: 'Ticket or stage not found' });
    await writeLog({ userId: req.user.id, action: 'ticket.stage', entity: 'tickets', entityId: r.id, meta: {
      from: before?.pipeline_stage_id, to: r.pipeline_stage_id, stage: r.stage_name,
    }});
    emitBroadcast('ticket:update', r);

    const becameClosed = r.status === 'closed' && before?.status !== 'closed';
    if (becameClosed) {
      email.sendTicketClosed(r, { clientUrl: CLIENT_URL })
        .catch((err) => console.error('[email] ticket.closed failed:', err.message));
    }
    res.json(r);
  } catch (e) { next(e); }
};

/* --------------------------------------------------------- SET STATUS */

exports.setStatus = async (req, res, next) => {
  try {
    const before = await service.getById(req.params.id);
    const r = await service.setStatus(req.params.id, req.body.status);
    await writeLog({ userId: req.user.id, action: 'ticket.status', entity: 'tickets', entityId: r.id, meta: { status: r.status } });
    emitBroadcast('ticket:update', r);

    // Email on close (only when transitioning to 'closed' or 'resolved' from a non-closed state)
    const becameClosed = r.status === 'closed' && before?.status !== 'closed';
    if (becameClosed) {
      email.sendTicketClosed(r, { clientUrl: CLIENT_URL })
        .catch((err) => console.error('[email] ticket.closed failed:', err.message));
    }
    res.json(r);
  } catch (e) { next(e); }
};

/* ---------------------------------------------------------------- ASSIGN */

exports.assign = async (req, res, next) => {
  try {
    const r = await service.assign(req.params.id, req.body || {});
    await writeLog({ userId: req.user.id, action: 'ticket.assign', entity: 'tickets', entityId: r.id, meta: {
      engineer: r.assigned_engineer_id, manager: r.reporting_manager_id,
    }});
    emitBroadcast('ticket:update', r);
    if (r.assigned_engineer_id) {
      await notifications.createAndEmit({
        user_id: r.assigned_engineer_id, type: 'ticket.assigned',
        title: 'Ticket assigned to you', message: `Ticket ${r.ticket_no || `#${r.id}`}: ${r.subject}`,
        link: `/tickets/${r.id}`,
      });
    }
    res.json(r);
  } catch (e) { next(e); }
};

/* --------------------------------------------------------------- ESCALATE */

exports.escalate = async (req, res, next) => {
  try {
    const r = await service.escalate(req.params.id);
    await writeLog({ userId: req.user.id, action: 'ticket.escalate', entity: 'tickets', entityId: r.id, meta: { level: r.escalation_level } });
    emitBroadcast('ticket:update', r);
    if (r.reporting_manager_id) {
      await notifications.createAndEmit({
        user_id: r.reporting_manager_id, type: 'ticket.escalated',
        title: `Ticket escalated (L${r.escalation_level})`,
        message: `Ticket ${r.ticket_no || `#${r.id}`}: ${r.subject}`,
        link: `/tickets/${r.id}`,
      });
    }
    res.json(r);
  } catch (e) { next(e); }
};

/* ----------------------------------------------------------------- DELETE */

exports.remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    await writeLog({ userId: req.user.id, action: 'ticket.delete', entity: 'tickets', entityId: req.params.id });
    emitBroadcast('ticket:delete', { id: Number(req.params.id) });
    res.status(204).end();
  } catch (e) { next(e); }
};

/* ------------------------------------------------------------ ACTIVITY
 *  Aggregated audit log scoped to a single ticket — used by the HubSpot-style
 *  "Activities" timeline on the ticket detail page.
 */
exports.listActivity = async (req, res, next) => {
  try {
    const result = await logsService.list({
      entity: 'tickets',
      entity_id: req.params.id,
      limit: Number(req.query.limit) || 200,
      order: 'asc',
    });
    res.json(result.data);
  } catch (e) { next(e); }
};

/* ------------------------------------------------------------ COMMENTS */

exports.listComments = async (req, res, next) => {
  try { res.json(await service.listComments(req.params.id)); } catch (e) { next(e); }
};
exports.addComment = async (req, res, next) => {
  try {
    const attachments = (req.files || []).map(f => ({
      filename: f.filename, original_name: f.originalname, size: f.size, mimetype: f.mimetype,
      url: `/uploads/${f.filename}`,
    }));
    const r = await service.addComment(req.params.id, {
      author_id: req.user.id, body: req.body.body, attachments,
    });
    await writeLog({ userId: req.user.id, action: 'ticket.comment', entity: 'tickets', entityId: req.params.id });
    emitBroadcast('ticket:comment', { ticket_id: Number(req.params.id), comment: r });
    res.status(201).json(r);
  } catch (e) { next(e); }
};
