const router = require('express').Router();
const ctrl = require('../controllers/users.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', requireRole('admin', 'manager'), ctrl.update);
router.patch('/:id/status', requireRole('admin'), ctrl.toggleStatus);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
