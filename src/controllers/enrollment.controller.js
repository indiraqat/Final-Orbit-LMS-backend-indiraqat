const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/enrollments  (ADMIN only)
// body: { userId, courseId }
async function createEnrollment(req, res) {
  const { userId, courseId } = req.body;

  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.course.findUnique({ where: { id: courseId } }),
  ]);
  if (!user) throw new ApiError(404, 'User not found.');
  if (!course) throw new ApiError(404, 'Course not found.');

  const enrollment = await prisma.enrollment.create({ data: { userId, courseId } });

  res.status(201).json({ data: enrollment });
}

// GET /api/users/:userId/enrollments
async function listEnrollmentsForUser(req, res) {
  if (req.user.role !== 'ADMIN' && req.user.id !== req.params.userId) {
    throw new ApiError(403, 'You can only view your own enrollments.');
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: req.params.userId },
    include: { course: true },
    orderBy: { enrolledAt: 'asc' },
  });

  res.json({ data: enrollments });
}

// DELETE /api/enrollments/:id  (ADMIN only)
async function deleteEnrollment(req, res) {
  await prisma.enrollment.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { createEnrollment, listEnrollmentsForUser, deleteEnrollment };
