const router = require('express').Router();
const ctrl = require('../controllers/ticketPipelines.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

router.get('/',           ctrl.list);
router.get('/default',    ctrl.getDefault);
router.get('/:id',        ctrl.get);
router.post('/',          requireRole('admin', 'manager'), ctrl.create);
router.put('/:id',        requireRole('admin', 'manager'), ctrl.update);
router.delete('/:id',     requireRole('admin'),            ctrl.remove);

router.get('/:pipelineId/stages',                ctrl.listStages);
router.post('/:pipelineId/stages',               requireRole('admin', 'manager'), ctrl.createStage);
router.post('/:pipelineId/stages/reorder',       requireRole('admin', 'manager'), ctrl.reorderStages);
router.put('/:pipelineId/stages/:stageId',       requireRole('admin', 'manager'), ctrl.updateStage);
router.delete('/:pipelineId/stages/:stageId',    requireRole('admin'),            ctrl.removeStage);

module.exports = router;
