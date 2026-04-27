const router = require('express').Router();
const ctrl = require('../controllers/tickets.controller');
const { auth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(auth);

// Reads — row-level scoped inside the controller/service by role.
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

// Engineers don't open new tickets — customers report them and admin/manager/sales log them.
router.post('/', requireRole('admin', 'manager', 'user'), ctrl.create);

// Update — row-scoped + sensitive fields stripped per role inside the controller.
router.put('/:id', ctrl.update);

// Status / stage moves are allowed for anyone with access to the ticket.
router.patch('/:id/status', ctrl.setStatus);
router.patch('/:id/stage',  ctrl.setStage);

// Assignment / reassignment is a routing decision — admin / manager only.
router.patch('/:id/assign', requireRole('admin', 'manager'), ctrl.assign);

// Escalation is the engineer's safety valve — anyone with access can use it.
router.patch('/:id/escalate', ctrl.escalate);

// Hard-delete is admin-only.
router.delete('/:id', requireRole('admin'), ctrl.remove);

// Activities (audit timeline scoped to this ticket)
router.get('/:id/activity', ctrl.listActivity);

// Comments + attachments
router.get('/:id/comments', ctrl.listComments);
router.post('/:id/comments', upload.array('files', 5), ctrl.addComment);

module.exports = router;
