const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const { ApiError } = require('../middleware/errorHandler');

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// GET /api/users  (ADMIN only — the team roster)
async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      enrollments: { include: { course: { select: { id: true, title: true } } } },
    },
  });

  res.json({
    data: users.map((u) => ({
      ...toPublicUser(u),
      courses: u.enrollments.map((e) => e.course),
    })),
  });
}

// GET /api/users/:id
async function getUser(req, res) {
  // A user can view their own profile; only an admin can view anyone else's.
  if (req.user.role !== 'ADMIN' && req.user.id !== req.params.id) {
    throw new ApiError(403, 'You can only view your own profile.');
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new ApiError(404, 'User not found.');

  res.json({ data: toPublicUser(user) });
}

// PUT /api/users/:id
async function updateUser(req, res) {
  if (req.user.role !== 'ADMIN' && req.user.id !== req.params.id) {
    throw new ApiError(403, 'You can only update your own profile.');
  }

  const { firstName, lastName, department, password, role } = req.body;

  // Only an admin can change someone's role.
  if (role !== undefined && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only an admin can change a user\'s role.');
  }

  const data = {
    ...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
    ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
    ...(department !== undefined ? { department: department?.trim() || null } : {}),
    ...(role !== undefined ? { role } : {}),
  };

  if (password !== undefined) {
    if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data });

  res.json({ data: toPublicUser(user) });
}

// DELETE /api/users/:id  (ADMIN only)
async function deleteUser(req, res) {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { listUsers, getUser, updateUser, deleteUser };
