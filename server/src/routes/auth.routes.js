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

router.patch(
  '/me',
  auth,
  [
    body('name').optional().isString().trim().isLength({ min: 1, max: 150 }),
    body('email').optional().isEmail(),
  ],
  validate,
  ctrl.updateMe,
);

router.post(
  '/me/password',
  auth,
  [
    body('current_password').isString().notEmpty(),
    body('new_password').isLength({ min: 6 }),
  ],
  validate,
  ctrl.changeMyPassword,
);

module.exports = router;
