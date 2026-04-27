const router = require('express').Router();
const ctrl = require('../controllers/stages.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);
router.get('/', ctrl.list);
router.post('/', requireRole('admin', 'manager'), ctrl.create);
router.put('/:id', requireRole('admin', 'manager'), ctrl.update);
router.delete('/:id', requireRole('admin', 'manager'), ctrl.remove);

module.exports = router;
