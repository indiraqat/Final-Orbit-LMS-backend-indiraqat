const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const userController = require('../controllers/user.controller');
const enrollmentController = require('../controllers/enrollment.controller');
const progressController = require('../controllers/progress.controller');

const router = express.Router();

router.use(requireAuth); // every route below requires a logged-in user

router.get('/', requireRole('ADMIN'), asyncHandler(userController.listUsers));
router.get('/:id', asyncHandler(userController.getUser)); // self-or-admin check inside
router.put('/:id', asyncHandler(userController.updateUser)); // self-or-admin check inside
router.delete('/:id', requireRole('ADMIN'), asyncHandler(userController.deleteUser));

router.get('/:userId/enrollments', asyncHandler(enrollmentController.listEnrollmentsForUser));
router.get('/:userId/progress', asyncHandler(progressController.getUserProgress));

module.exports = router;
