const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const courseRoutes = require('./course.routes');
const moduleRoutes = require('./module.routes');
const materialRoutes = require('./material.routes');
const quizRoutes = require('./quiz.routes');
const questionRoutes = require('./question.routes');
const enrollmentRoutes = require('./enrollment.routes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courses', courseRoutes);
router.use('/modules', moduleRoutes);
router.use('/materials', materialRoutes);
router.use('/quizzes', quizRoutes);
router.use('/questions', questionRoutes);
router.use('/enrollments', enrollmentRoutes);

module.exports = router;
