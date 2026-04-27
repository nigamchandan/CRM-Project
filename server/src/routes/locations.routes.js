const router = require('express').Router();
const ctrl = require('../controllers/locations.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);
router.get('/',     ctrl.list);
router.get('/:id',  ctrl.get);
router.post('/',    requireRole('admin', 'manager'), ctrl.create);
router.put('/:id',  requireRole('admin', 'manager'), ctrl.update);
router.delete('/:id', requireRole('admin'),          ctrl.remove);

module.exports = router;
