const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/courses  (public — the course catalog)
async function listCourses(req, res) {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { modules: true, enrollments: true } },
    },
  });

  res.json({
    data: courses.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      description: c.description,
      moduleCount: c._count.modules,
      enrolledCount: c._count.enrollments,
      createdAt: c.createdAt,
    })),
  });
}

// GET /api/courses/:id
async function getCourse(req, res) {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: {
          materials: { orderBy: { order: 'asc' } },
          quiz: { include: { questions: { include: { options: true } } } },
        },
      },
    },
  });

  if (!course) throw new ApiError(404, 'Course not found.');

  res.json({ data: course });
}

// POST /api/courses  (ADMIN only)
async function createCourse(req, res) {
  const { title, category, description } = req.body;

  const course = await prisma.course.create({
    data: { title: title.trim(), category: category.trim(), description: description?.trim() || null },
  });

  res.status(201).json({ data: course });
}

// PUT /api/courses/:id  (ADMIN only)
async function updateCourse(req, res) {
  const { title, category, description } = req.body;

  const course = await prisma.course.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(category !== undefined ? { category: category.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
    },
  });

  res.json({ data: course });
}

// DELETE /api/courses/:id  (ADMIN only)
// Cascades to modules/materials/quizzes/enrollments via the schema's onDelete: Cascade.
async function deleteCourse(req, res) {
  await prisma.course.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listCourses, getCourse, createCourse, updateCourse, deleteCourse };
