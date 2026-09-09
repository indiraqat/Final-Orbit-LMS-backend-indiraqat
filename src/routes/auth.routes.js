const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/register',
  validateBody({
    firstName: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    lastName: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    email: { required: true, type: 'string', email: true },
    password: { required: true, type: 'string', minLength: 8 },
    role: { required: false, type: 'string', enum: ['ADMIN', 'INTERN'] },
  }),
  asyncHandler(authController.register)
);

router.post(
  '/login',
  validateBody({
    email: { required: true, type: 'string', email: true },
    password: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(authController.login)
);

router.get('/me', requireAuth, asyncHandler(authController.me));

module.exports = router;
