const router = require('express').Router();
const ctrl = require('../controllers/tickets.controller');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(auth);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/status', ctrl.setStatus);
router.patch('/:id/stage', ctrl.setStage);
router.patch('/:id/assign', ctrl.assign);
router.patch('/:id/escalate', ctrl.escalate);
router.delete('/:id', ctrl.remove);

// Activities (audit timeline scoped to this ticket)
router.get('/:id/activity', ctrl.listActivity);

// Comments + attachments
router.get('/:id/comments', ctrl.listComments);
router.post('/:id/comments', upload.array('files', 5), ctrl.addComment);

module.exports = router;
