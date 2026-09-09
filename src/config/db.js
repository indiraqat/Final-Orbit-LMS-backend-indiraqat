require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Reuse a single Prisma Client instance across the app (and across
// hot-reloads in dev) instead of opening a new connection pool per import.
const prisma = global.__orbitPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__orbitPrisma = prisma;
}

module.exports = prisma;