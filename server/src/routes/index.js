const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/contacts', require('./contacts.routes'));
router.use('/leads', require('./leads.routes'));
router.use('/deals', require('./deals.routes'));
router.use('/pipeline-stages', require('./stages.routes'));
router.use('/ticket-pipelines', require('./ticketPipelines.routes'));
router.use('/tickets', require('./tickets.routes'));
router.use('/tasks', require('./tasks.routes'));
router.use('/locations', require('./locations.routes'));
router.use('/teams',     require('./teams.routes'));
router.use('/projects',  require('./projects.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/next-actions', require('./nextActions.routes'));
router.use('/settings', require('./settings.routes'));
router.use('/logs', require('./logs.routes'));

module.exports = router;
