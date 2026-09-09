const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

// Run `npm run seed` before these — they rely on mentor@orbit.com and
// jane.smith@orbit.com existing, plus the 3 seeded courses.

async function loginAs(email, password = 'password123') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

test('GET /api/courses is public and returns the seeded courses', async () => {
  const res = await request(app).get('/api/courses');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 3);
  assert.ok('moduleCount' in res.body.data[0]);
});

test('POST /api/courses is rejected with no token (401)', async () => {
  const res = await request(app).post('/api/courses').send({
    title: 'Unauthorized Course',
    category: 'Test',
  });

  assert.equal(res.status, 401);
});

test('POST /api/courses is rejected for an INTERN role (403)', async () => {
  const token = await loginAs('jane.smith@orbit.com');

  const res = await request(app)
    .post('/api/courses')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Should Not Be Created', category: 'Test' });

  assert.equal(res.status, 403);
});

test('POST /api/courses is rejected with an invalid body, even as ADMIN (400)', async () => {
  const token = await loginAs('mentor@orbit.com');

  const res = await request(app)
    .post('/api/courses')
    .set('Authorization', `Bearer ${token}`)
    .send({ category: 'Missing title field' });

  assert.equal(res.status, 400);
});

test('Full CRUD lifecycle for a course as ADMIN', async () => {
  const token = await loginAs('mentor@orbit.com');
  const authHeader = { Authorization: `Bearer ${token}` };

  // CREATE
  const created = await request(app)
    .post('/api/courses')
    .set(authHeader)
    .send({ title: 'Integration Test Course', category: 'Testing', description: 'Created by an integration test.' });
  assert.equal(created.status, 201);
  const courseId = created.body.data.id;

  // READ
  const fetched = await request(app).get(`/api/courses/${courseId}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.data.title, 'Integration Test Course');

  // UPDATE
  const updated = await request(app)
    .put(`/api/courses/${courseId}`)
    .set(authHeader)
    .send({ title: 'Integration Test Course (Updated)' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, 'Integration Test Course (Updated)');

  // DELETE
  const deleted = await request(app).delete(`/api/courses/${courseId}`).set(authHeader);
  assert.equal(deleted.status, 204);

  // Confirm it's actually gone (data integrity / cascade)
  const afterDelete = await request(app).get(`/api/courses/${courseId}`);
  assert.equal(afterDelete.status, 404);
});

test('GET /api/courses/:id returns 404 for a non-existent course', async () => {
  const res = await request(app).get('/api/courses/00000000-0000-0000-0000-000000000000');
  assert.equal(res.status, 404);
});