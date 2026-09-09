const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// Strip isCorrect from options unless the caller is an admin — an intern
// taking the quiz should never receive the answer key in the response.
function serializeQuiz(quiz, viewerRole) {
  if (!quiz) return quiz;
  return {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      ...q,
      options: q.options.map((o) =>
        viewerRole === 'ADMIN' ? o : { id: o.id, text: o.text, order: o.order }
      ),
    })),
  };
}

// GET /api/modules/:moduleId/quiz
async function getQuizByModule(req, res) {
  const quiz = await prisma.quiz.findUnique({
    where: { moduleId: req.params.moduleId },
    include: { questions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } } },
  });

  if (!quiz) throw new ApiError(404, 'This module does not have a quiz yet.');

  res.json({ data: serializeQuiz(quiz, req.user?.role) });
}

// POST /api/modules/:moduleId/quiz  (ADMIN only)
async function createQuiz(req, res) {
  const { title } = req.body;

  const module = await prisma.module.findUnique({ where: { id: req.params.moduleId } });
  if (!module) throw new ApiError(404, 'Module not found.');

  const existing = await prisma.quiz.findUnique({ where: { moduleId: req.params.moduleId } });
  if (existing) throw new ApiError(409, 'This module already has a quiz. Edit it instead of creating a new one.');

  const quiz = await prisma.quiz.create({
    data: { moduleId: req.params.moduleId, title: title.trim() },
  });

  res.status(201).json({ data: quiz });
}

// PUT /api/quizzes/:id  (ADMIN only)
async function updateQuiz(req, res) {
  const { title } = req.body;

  const quiz = await prisma.quiz.update({
    where: { id: req.params.id },
    data: { ...(title !== undefined ? { title: title.trim() } : {}) },
  });

  res.json({ data: quiz });
}

// DELETE /api/quizzes/:id  (ADMIN only)
async function deleteQuiz(req, res) {
  await prisma.quiz.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

// POST /api/quizzes/:quizId/questions  (ADMIN only)
// body: { text, options: [{ text, isCorrect }, ...] }  — needs 2+ options, exactly one correct.
async function createQuestion(req, res) {
  const { text, options, order } = req.body;

  if (!Array.isArray(options) || options.length < 2) {
    throw new ApiError(400, '"options" must be an array with at least 2 options.');
  }
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) {
    throw new ApiError(400, 'Exactly one option must be marked as correct.');
  }
  if (options.some((o) => !o.text || !o.text.trim())) {
    throw new ApiError(400, 'Every option needs non-empty text.');
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.quizId } });
  if (!quiz) throw new ApiError(404, 'Quiz not found.');

  const question = await prisma.quizQuestion.create({
    data: {
      quizId: req.params.quizId,
      text: text.trim(),
      order: Number.isInteger(order) ? order : 0,
      options: {
        create: options.map((o, i) => ({
          text: o.text.trim(),
          isCorrect: Boolean(o.isCorrect),
          order: i,
        })),
      },
    },
    include: { options: true },
  });

  res.status(201).json({ data: question });
}

// PUT /api/questions/:id  (ADMIN only)
// body: { text?, options? }  — if options is provided, it fully replaces the existing set.
async function updateQuestion(req, res) {
  const { text, options } = req.body;

  if (options !== undefined) {
    if (!Array.isArray(options) || options.length < 2) {
      throw new ApiError(400, '"options" must be an array with at least 2 options.');
    }
    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new ApiError(400, 'Exactly one option must be marked as correct.');
    }
  }

  const question = await prisma.$transaction(async (tx) => {
    if (options !== undefined) {
      await tx.quizOption.deleteMany({ where: { questionId: req.params.id } });
    }

    return tx.quizQuestion.update({
      where: { id: req.params.id },
      data: {
        ...(text !== undefined ? { text: text.trim() } : {}),
        ...(options !== undefined
          ? {
              options: {
                create: options.map((o, i) => ({
                  text: o.text.trim(),
                  isCorrect: Boolean(o.isCorrect),
                  order: i,
                })),
              },
            }
          : {}),
      },
      include: { options: true },
    });
  });

  res.json({ data: question });
}

// DELETE /api/questions/:id  (ADMIN only)
async function deleteQuestion(req, res) {
  await prisma.quizQuestion.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = {
  getQuizByModule,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
