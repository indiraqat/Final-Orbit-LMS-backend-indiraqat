const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const enrollmentController = require('../controllers/enrollment.controller');

const router = express.Router();

const enrollmentSchema = {
  userId: { required: true, type: 'string', minLength: 1 },
  courseId: { required: true, type: 'string', minLength: 1 },
};

router.post('/', requireAuth, requireRole('ADMIN'), validateBody(enrollmentSchema), asyncHandler(enrollmentController.createEnrollment));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(enrollmentController.deleteEnrollment));

module.exports = router;
