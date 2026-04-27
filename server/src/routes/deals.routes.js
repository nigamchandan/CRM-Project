const router = require('express').Router();
const ctrl = require('../controllers/deals.controller');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', ctrl.list);
router.get('/board', ctrl.board);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/stage', ctrl.moveStage);
router.delete('/:id', ctrl.remove);

module.exports = router;
