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
// Per-course item breakdown: materials + quiz each count as one item,
// matching the "X / Y items · Z%" tracking model used on the frontend.
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
            include: { materials: true, quiz: true },
          },
        },
      },
    },
  });

  const [completedMaterialIds, passedQuizIds] = await Promise.all([
    prisma.materialCompletion
      .findMany({ where: { userId: req.params.userId }, select: { materialId: true } })
      .then((rows) => new Set(rows.map((r) => r.materialId))),
    prisma.quizAttempt
      .findMany({ where: { userId: req.params.userId, passed: true }, select: { quizId: true } })
      .then((rows) => new Set(rows.map((r) => r.quizId))),
  ]);

  const courses = enrollments.map(({ course }) => {
    const modules = course.modules.map((module) => {
      const totalItems = module.materials.length + (module.quiz ? 1 : 0);
      const completedItems =
        module.materials.filter((m) => completedMaterialIds.has(m.id)).length +
        (module.quiz && passedQuizIds.has(module.quiz.id) ? 1 : 0);

      return {
        id: module.id,
        title: module.title,
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
