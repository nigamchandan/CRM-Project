const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { auth } = require('../middleware/auth');

router.post(
  '/register',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
  ],
  validate,
  ctrl.register
);

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  ctrl.login
);

router.get('/me', auth, ctrl.me);
router.post('/logout', auth, ctrl.logout);

module.exports = router;
