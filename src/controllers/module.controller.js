const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/courses/:courseId/modules  (public)
async function listModules(req, res) {
  const modules = await prisma.module.findMany({
    where: { courseId: req.params.courseId },
    orderBy: { order: 'asc' },
    include: {
      materials: { orderBy: { order: 'asc' } },
      quiz: { include: { questions: true } },
    },
  });

  res.json({ data: modules });
}

// GET /api/modules/:id  (public)
async function getModule(req, res) {
  const module = await prisma.module.findUnique({
    where: { id: req.params.id },
    include: {
      materials: { orderBy: { order: 'asc' } },
      quiz: { include: { questions: { include: { options: true } } } },
    },
  });

  if (!module) throw new ApiError(404, 'Module not found.');

  res.json({ data: module });
}

// POST /api/courses/:courseId/modules  (ADMIN only)
async function createModule(req, res) {
  const { title, order, published } = req.body;

  const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
  if (!course) throw new ApiError(404, 'Course not found.');

  const module = await prisma.module.create({
    data: {
      title: title.trim(),
      courseId: req.params.courseId,
      order: Number.isInteger(order) ? order : 0,
      published: published !== undefined ? Boolean(published) : true,
    },
  });

  res.status(201).json({ data: module });
}

// PUT /api/modules/:id  (ADMIN only)
async function updateModule(req, res) {
  const { title, order, published } = req.body;

  const module = await prisma.module.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(order !== undefined ? { order: Number(order) } : {}),
      ...(published !== undefined ? { published: Boolean(published) } : {}),
    },
  });

  res.json({ data: module });
}

// DELETE /api/modules/:id  (ADMIN only)
// Cascades to materials/quiz via the schema's onDelete: Cascade.
async function deleteModule(req, res) {
  await prisma.module.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listModules, getModule, createModule, updateModule, deleteModule };
