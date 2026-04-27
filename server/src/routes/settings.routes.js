const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

// generic key/value
router.get('/',  ctrl.getAll);
router.put('/',  requireRole('admin'), ctrl.upsert);

// dedicated SLA endpoints (used by Settings → SLA tab)
router.get('/sla', ctrl.getSla);
router.put('/sla', requireRole('admin'), ctrl.setSla);

// dedicated email notification endpoints (used by Settings → Email tab)
router.get('/email', ctrl.getEmail);
router.put('/email', requireRole('admin'), ctrl.setEmail);

module.exports = router;
