const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const quizController = require('../controllers/quiz.controller');

const router = express.Router();

router.put('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(quizController.updateQuestion));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(quizController.deleteQuestion));

module.exports = router;
