const router = require('express').Router();
const ctrl = require('../controllers/logs.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth, requireRole('admin', 'manager'));
router.get('/', ctrl.list);

module.exports = router;
