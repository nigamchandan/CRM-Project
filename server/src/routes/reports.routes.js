const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/dashboard', ctrl.dashboard);
router.get('/leads-by-status', ctrl.leadsByStatus);
router.get('/deals-by-stage', ctrl.dealsByStage);
router.get('/tickets-resolution', ctrl.ticketsResolution);
router.get('/revenue-trend', ctrl.revenueTrend);
router.get('/recent-activity', ctrl.recentActivity);
router.get('/upcoming-tasks', ctrl.upcomingTasks);
router.get('/sales-funnel', ctrl.salesFunnel);
router.get('/team-performance', ctrl.teamPerformance);
router.get('/sla-performance',  ctrl.slaPerformance);
router.get('/alerts',           ctrl.alerts);

// Sales dashboard (per-user)
router.get('/my-dashboard',     ctrl.myDashboard);
router.get('/my-pipeline',      ctrl.myPipeline);
router.get('/my-tasks',         ctrl.myTasks);
router.get('/my-next-actions',  ctrl.myNextActions);
router.get('/my-activity',      ctrl.myActivity);

// Support dashboard (per-user)
router.get('/my-tickets-dashboard', ctrl.myTicketsDashboard);
router.get('/my-tickets-queue',     ctrl.myTicketsQueue);
router.get('/my-tickets-activity',  ctrl.myTicketsActivity);

module.exports = router;
