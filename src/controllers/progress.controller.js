const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/materials/:materialId/complete  (self only — the logged-in intern)
async function completeMaterial(req, res) {
  const material = await prisma.material.findUnique({ where: { id: req.params.materialId } });
  if (!material) throw new ApiError(404, 'Material not found.');

  const completion = await prisma.materialCompletion.upsert({
    where: { userId_materialId: { userId: req.user.id, materialId: req.params.materialId } },
    update: {},
    create: { userId: req.user.id, materialId: req.params.materialId },
  });

  res.status(201).json({ data: completion });
}

// POST /api/quizzes/:quizId/attempt  (self only — the logged-in intern)
// body: { answers: [{ questionId, optionId }, ...] }
// Grades server-side against the answer key — the client never needs to
// know which options are correct ahead of submitting.
async function submitQuizAttempt(req, res) {
  const { answers } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new ApiError(400, '"answers" must be a non-empty array of { questionId, optionId }.');
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: req.params.quizId },
    include: { questions: { include: { options: true } } },
  });
  if (!quiz) throw new ApiError(404, 'Quiz not found.');

  const results = quiz.questions.map((question) => {
    const submitted = answers.find((a) => a.questionId === question.id);
    const correctOption = question.options.find((o) => o.isCorrect);
    const selectedOption = question.options.find((o) => o.id === submitted?.optionId);
    const isCorrect = Boolean(selectedOption && selectedOption.isCorrect);

    return {
      questionId: question.id,
      questionText: question.text,
      selectedOptionId: selectedOption?.id || null,
      selectedOptionText: selectedOption?.text || null,
      correctOptionId: correctOption?.id || null,
      correctOptionText: correctOption?.text || null,
      isCorrect,
    };
  });

  const score = results.filter((r) => r.isCorrect).length;
  const totalQuestions = quiz.questions.length;
  const passed = totalQuestions > 0 && score / totalQuestions >= 0.7;

  const attempt = await prisma.quizAttempt.create({
    data: { userId: req.user.id, quizId: quiz.id, score, totalQuestions, passed },
  });

  res.status(201).json({
    data: {
      attemptId: attempt.id,
      score,
      totalQuestions,
      percent: totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0,
      passed,
      completedAt: attempt.completedAt,
      results,
    },
  });
}

// GET /api/users/:userId/progress
// Per-course, per-module breakdown: materials + quiz each count as one item
// toward that module's percent, matching the "X / Y items · Z%" tracking
// model used on the frontend. Also includes enough detail (material
// completion flags, quiz attempt status) for course-detail and quizzes
// pages to render real state without extra round trips.
async function getUserProgress(req, res) {
  if (req.user.role !== 'ADMIN' && req.user.id !== req.params.userId) {
    throw new ApiError(403, 'You can only view your own progress.');
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: req.params.userId },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: {
              materials: { orderBy: { order: 'asc' } },
              quiz: { include: { _count: { select: { questions: true } } } },
            },
          },
        },
      },
    },
  });

  const [completedMaterialIds, attemptsByQuizId] = await Promise.all([
    prisma.materialCompletion
      .findMany({ where: { userId: req.params.userId }, select: { materialId: true } })
      .then((rows) => new Set(rows.map((r) => r.materialId))),
    prisma.quizAttempt
      .findMany({ where: { userId: req.params.userId }, orderBy: { completedAt: 'desc' } })
      .then((rows) => {
        const map = new Map();
        // rows are newest-first, so the first one seen per quizId is the latest attempt
        for (const row of rows) {
          if (!map.has(row.quizId)) map.set(row.quizId, row);
        }
        return map;
      }),
  ]);

  const courses = enrollments.map(({ course }) => {
    const modules = course.modules.map((module) => {
      const materials = module.materials.map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        url: m.url,
        completed: completedMaterialIds.has(m.id),
      }));

      const latestAttempt = module.quiz ? attemptsByQuizId.get(module.quiz.id) : null;
      const quiz = module.quiz
        ? {
            id: module.quiz.id,
            title: module.quiz.title,
            totalQuestions: module.quiz._count.questions,
            attempted: Boolean(latestAttempt),
            passed: latestAttempt?.passed || false,
            score: latestAttempt?.score ?? null,
            percent: latestAttempt
              ? Math.round((latestAttempt.score / latestAttempt.totalQuestions) * 100)
              : null,
          }
        : null;

      const totalItems = materials.length + (quiz ? 1 : 0);
      const completedItems =
        materials.filter((m) => m.completed).length + (quiz && quiz.passed ? 1 : 0);

      return {
        id: module.id,
        title: module.title,
        published: module.published,
        materials,
        quiz,
        totalItems,
        completedItems,
        percent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      };
    });

    const totalItems = modules.reduce((sum, m) => sum + m.totalItems, 0);
    const completedItems = modules.reduce((sum, m) => sum + m.completedItems, 0);

    return {
      id: course.id,
      title: course.title,
      modules,
      totalItems,
      completedItems,
      percent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    };
  });

  res.json({ data: courses });
}

module.exports = { completeMaterial, submitQuizAttempt, getUserProgress };