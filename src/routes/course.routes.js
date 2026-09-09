const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const courseController = require('../controllers/course.controller');
const moduleController = require('../controllers/module.controller');

const router = express.Router();

const courseSchema = {
  title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
  category: { required: true, type: 'string', minLength: 1, maxLength: 100 },
  description: { required: false, type: 'string', maxLength: 2000 },
};
const courseUpdateSchema = { ...courseSchema, title: { ...courseSchema.title, required: false }, category: { ...courseSchema.category, required: false } };

const moduleSchema = {
  title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
};

// Public reads
router.get('/', asyncHandler(courseController.listCourses));
router.get('/:id', asyncHandler(courseController.getCourse));
router.get('/:courseId/modules', asyncHandler(moduleController.listModules));

// Writes — ADMIN only
router.post('/', requireAuth, requireRole('ADMIN'), validateBody(courseSchema), asyncHandler(courseController.createCourse));
router.put('/:id', requireAuth, requireRole('ADMIN'), validateBody(courseUpdateSchema), asyncHandler(courseController.updateCourse));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(courseController.deleteCourse));

router.post('/:courseId/modules', requireAuth, requireRole('ADMIN'), validateBody(moduleSchema), asyncHandler(moduleController.createModule));

module.exports = router;
