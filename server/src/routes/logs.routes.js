const router = require('express').Router();
const ctrl = require('../controllers/logs.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth, requireRole('admin', 'manager'));

router.get('/',         ctrl.list);
router.get('/actions',  ctrl.actions);
router.get('/entities', ctrl.entities);
router.get('/export',   ctrl.export);
router.post('/purge',   requireRole('admin'), ctrl.purgeNow);

module.exports = router;
