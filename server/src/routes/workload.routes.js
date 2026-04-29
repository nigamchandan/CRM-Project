const router = require('express').Router();
const ctrl = require('../controllers/workload.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

// Workload visibility is a routing/triage tool — only admins and managers
// can see how loaded each engineer is. Engineers don't need to see peers'
// load, and exposing it widely turns it into a comparison metric.
router.get('/engineers', requireRole('admin', 'manager'), ctrl.engineerLoad);
router.get('/suggest',   requireRole('admin', 'manager'), ctrl.suggest);

module.exports = router;
