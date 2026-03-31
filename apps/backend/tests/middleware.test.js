const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/protected', auth, (_req, res) => res.json({ ok: true }));
  app.get('/admin-only', auth, adminAuth, (_req, res) => res.json({ ok: true }));

  return app;
}

const app = buildApp();

const ACTIVE_USER = { _id: '507f1f77bcf86cd799439011', role: 'user', deletedAt: null };

beforeEach(() => {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(ACTIVE_USER),
  });
});

function makeToken(payload) {
  return jwt.sign({ user: payload }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('auth middleware', () => {
  it('allows request with valid token', async () => {
    const token = makeToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
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
    const token = makeToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', token);

    expect(res.statusCode).toBe(401);
  });

  it('rejects expired token', async () => {
    const token = jwt.sign(
      { user: { id: '507f1f77bcf86cd799439011', role: 'user' } },
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

  it('rejects when user is soft-deleted', async () => {
    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', role: 'user', deletedAt: new Date() }),
    });
    const token = makeToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });

  it('rejects when user document is missing', async () => {
    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue(null),
    });
    const token = makeToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
  });
});

describe('adminAuth middleware', () => {
  it('allows admin role', async () => {
    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: '607f1f77bcf86cd799439011', role: 'admin', deletedAt: null }),
    });
    const token = makeToken({ id: '607f1f77bcf86cd799439011', role: 'admin' });
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  it('rejects user role', async () => {
    const token = makeToken({ id: '507f1f77bcf86cd799439011', role: 'user' });
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
  });

  it('rejects worker role', async () => {
    User.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ _id: '707f1f77bcf86cd799439011', role: 'worker', deletedAt: null }),
    });
    const token = makeToken({ id: '707f1f77bcf86cd799439011', role: 'worker' });
    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(403);
  });
});
