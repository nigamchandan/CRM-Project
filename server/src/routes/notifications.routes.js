const router = require('express').Router();
const ctrl = require('../controllers/notifications.controller');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', ctrl.list);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);
router.delete('/:id', ctrl.remove);

module.exports = router;
