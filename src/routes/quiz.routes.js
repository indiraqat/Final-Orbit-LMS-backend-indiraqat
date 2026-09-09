const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { validateBody } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const quizController = require('../controllers/quiz.controller');
const progressController = require('../controllers/progress.controller');

const router = express.Router();

const quizUpdateSchema = { title: { required: false, type: 'string', minLength: 1, maxLength: 200 } };
const questionSchema = { text: { required: true, type: 'string', minLength: 1, maxLength: 1000 } };
const attemptSchema = {}; // "answers" array shape is checked in the controller (needs custom shape validation)

router.put('/:id', requireAuth, requireRole('ADMIN'), validateBody(quizUpdateSchema), asyncHandler(quizController.updateQuiz));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(quizController.deleteQuiz));

router.post('/:quizId/questions', requireAuth, requireRole('ADMIN'), validateBody(questionSchema), asyncHandler(quizController.createQuestion));

// Progress: an intern submitting (and getting graded on) a quiz attempt
router.post('/:quizId/attempt', requireAuth, validateBody(attemptSchema), asyncHandler(progressController.submitQuizAttempt));

module.exports = router;
