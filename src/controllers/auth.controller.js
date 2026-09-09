const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { signToken } = require('../utils/jwt');
const { ApiError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 10;

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// POST /api/auth/register
async function register(req, res) {
  const { firstName, lastName, email, password, role, department } = req.body;

  // role defaults to INTERN — nobody can register themselves as ADMIN.
  // Promoting a user to ADMIN is an action an existing admin takes via
  // PUT /api/users/:id, not something the register endpoint exposes.
  const safeRole = role === 'ADMIN' ? 'INTERN' : role || 'INTERN';

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: safeRole,
      department: department?.trim() || null,
    },
  });

  const token = signToken(user);

  res.status(201).json({ data: { user: toPublicUser(user), token } });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password.');

  const token = signToken(user);

  res.json({ data: { user: toPublicUser(user), token } });
}

// GET /api/auth/me  (requires auth)
async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new ApiError(404, 'User not found.');

  res.json({ data: toPublicUser(user) });
}

module.exports = { register, login, me };
