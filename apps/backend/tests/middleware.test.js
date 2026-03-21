const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { auth, adminAuth } = require('../middleware/auth');

function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/protected', auth, (_req, res) => res.json({ ok: true }));
  app.get('/admin-only', auth, adminAuth, (_req, res) => res.json({ ok: true }));

  return app;
}

const app = buildApp();

function makeToken(payload) {
  return jwt.sign({ user: payload }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('auth middleware', () => {
  it('allows request with valid token', async () => {
    const token = makeToken({ id: 'user123', role: 'user' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects missing Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed header (no Bearer prefix)', async () => {
    const token = makeToken({ id: 'user123', role: 'user' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', token);

    expect(res.statusCode).toBe(401);
  });

  it('rejects expired token', async () => {
    const token = jwt.sign(
      { user: { id: 'user123', role: 'user' } },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });

  it('rejects token signed with wrong secret', async () => {
    const token = jwt.sign({ user: { id: 'x', role: 'user' } }, 'wrong-secret');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });
});

describe('adminAuth middleware', () => {
  it('allows admin role', async () => {
    const token = makeToken({ id: 'admin1', role: 'admin' });
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  it('rejects user role', async () => {
    const token = makeToken({ id: 'user1', role: 'user' });
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
  });

  it('rejects worker role', async () => {
    const token = makeToken({ id: 'worker1', role: 'worker' });
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
  });
});
