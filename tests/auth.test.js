const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

// These are integration tests: they hit the real Express app (in-process,
// no network) and the real database via Prisma. Run `npm run seed` first
// so mentor@orbit.com / jane.smith@orbit.com exist with password123.

test('POST /api/auth/register creates a new user and returns a token', async () => {
  const uniqueEmail = `test-${Date.now()}@orbit.com`;

  const res = await request(app).post('/api/auth/register').send({
    firstName: 'Test',
    lastName: 'User',
    email: uniqueEmail,
    password: 'password123',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, uniqueEmail);
  assert.equal(res.body.data.user.role, 'INTERN'); // can't self-assign ADMIN
  assert.ok(res.body.data.token, 'expected a JWT in the response');
  assert.equal(res.body.data.user.passwordHash, undefined, 'password hash should never be returned');
});

test('POST /api/auth/register rejects a duplicate email', async () => {
  const res = await request(app).post('/api/auth/register').send({
    firstName: 'Duplicate',
    lastName: 'User',
    email: 'jane.smith@orbit.com', // already exists from the seed
    password: 'password123',
  });

  assert.equal(res.status, 409);
});

test('POST /api/auth/register rejects a missing/invalid body', async () => {
  const res = await request(app).post('/api/auth/register').send({
    firstName: 'Missing',
    // lastName missing, invalid email, password too short
    email: 'not-an-email',
    password: 'short',
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.message.length > 0);
});

test('POST /api/auth/login succeeds with correct seeded credentials', async () => {
  const res = await request(app).post('/api/auth/login').send({
    email: 'jane.smith@orbit.com',
    password: 'password123',
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'jane.smith@orbit.com');
  assert.ok(res.body.data.token);
});

test('POST /api/auth/login fails with the wrong password', async () => {
  const res = await request(app).post('/api/auth/login').send({
    email: 'jane.smith@orbit.com',
    password: 'wrong-password',
  });

  assert.equal(res.status, 401);
});

test('GET /api/auth/me requires a token', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.equal(res.status, 401);
});

test('GET /api/auth/me returns the logged-in user with a valid token', async () => {
  const login = await request(app).post('/api/auth/login').send({
    email: 'jane.smith@orbit.com',
    password: 'password123',
  });

  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${login.body.data.token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.email, 'jane.smith@orbit.com');
});