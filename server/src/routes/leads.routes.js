const router = require('express').Router();
const ctrl = require('../controllers/leads.controller');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/assign', ctrl.assign);
router.patch('/:id/status', ctrl.setStatus);
router.delete('/:id', ctrl.remove);

module.exports = router;
