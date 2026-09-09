const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const moduleController = require('../controllers/module.controller');
const materialController = require('../controllers/material.controller');
const quizController = require('../controllers/quiz.controller');

const router = express.Router();

const moduleUpdateSchema = {
  title: { required: false, type: 'string', minLength: 1, maxLength: 200 },
};

const materialSchema = {
  title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
  type: { required: true, type: 'string', enum: ['DOCUMENT', 'VIDEO_UPLOAD', 'VIDEO_LINK'] },
  url: { required: false, type: 'string', maxLength: 1000 },
};

const quizSchema = {
  title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
};

// Public reads
router.get('/:id', asyncHandler(moduleController.getModule));
router.get('/:moduleId/materials', asyncHandler(materialController.listMaterials));
router.get('/:moduleId/quiz', asyncHandler(quizController.getQuizByModule));

// Writes — ADMIN only
router.put('/:id', requireAuth, requireRole('ADMIN'), validateBody(moduleUpdateSchema), asyncHandler(moduleController.updateModule));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(moduleController.deleteModule));

router.post('/:moduleId/materials', requireAuth, requireRole('ADMIN'), validateBody(materialSchema), asyncHandler(materialController.createMaterial));
router.post('/:moduleId/quiz', requireAuth, requireRole('ADMIN'), validateBody(quizSchema), asyncHandler(quizController.createQuiz));

module.exports = router;
