const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../app');
const Media = require('../models/Media');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

async function registerAndToken() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Dash', email: 'dash@example.com', password: 'password123' });
  expect(res.statusCode).toBe(201);
  const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
  return { token: res.body.token, userId: decoded.user.id };
}

describe('GET /api/media periodScope=range', () => {
  it('excludes COMPLETED media whose completedAt is outside the range', async () => {
    const { token, userId } = await registerAndToken();

    await Media.create({
      mediaUploadedBy: new mongoose.Types.ObjectId(userId),
      filename: 'march.mp4',
      mediaType: 'VIDEO',
      format: 'mp4',
      status: 'COMPLETED',
      lengthMs: 180000,
      sizeBytes: 15_000_000,
      storage: { bucket: 'test', key: 'media/x/march.mp4', format: 'mp4' },
      completedAt: new Date('2026-03-16T12:00:00.000Z'),
    });

    const janStart = '2026-01-01T00:00:00.000Z';
    const janEnd = '2026-01-04T00:00:00.000Z';

    const list = await request(app)
      .get('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .query({
        periodScope: 'range',
        periodStart: janStart,
        periodEnd: janEnd,
        limit: 20,
        page: 1,
      });

    expect(list.statusCode).toBe(200);
    expect(list.body.total).toBe(0);
    expect(list.body.media).toHaveLength(0);

    const stats = await request(app)
      .get('/api/analytics/me')
      .set('Authorization', `Bearer ${token}`)
      .query({ periodScope: 'range', periodStart: janStart, periodEnd: janEnd });

    expect(stats.statusCode).toBe(200);
    expect(stats.body.totalFiles).toBe(0);
    expect(stats.body.period).toEqual({ start: janStart, end: janEnd });
  });

  it('includes COMPLETED media when completedAt is inside the range', async () => {
    const { token, userId } = await registerAndToken();

    await Media.create({
      mediaUploadedBy: new mongoose.Types.ObjectId(userId),
      filename: 'jan.mp4',
      mediaType: 'VIDEO',
      format: 'mp4',
      status: 'COMPLETED',
      lengthMs: 120000,
      sizeBytes: 10_000_000,
      storage: { bucket: 'test', key: 'media/x/jan.mp4', format: 'mp4' },
      completedAt: new Date('2026-01-02T15:00:00.000Z'),
    });

    const janStart = '2026-01-01T00:00:00.000Z';
    const janEnd = '2026-01-04T00:00:00.000Z';

    const list = await request(app)
      .get('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .query({ periodScope: 'range', periodStart: janStart, periodEnd: janEnd });

    expect(list.statusCode).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.media[0].filename).toBe('jan.mp4');
  });

  it('returns 422 when periodScope=range but dates missing', async () => {
    const { token } = await registerAndToken();

    const list = await request(app)
      .get('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .query({ periodScope: 'range' });

    expect(list.statusCode).toBe(422);

    const stats = await request(app)
      .get('/api/analytics/me')
      .set('Authorization', `Bearer ${token}`)
      .query({ periodScope: 'range' });

    expect(stats.statusCode).toBe(422);
  });
});

describe('GET /api/media periodScope=all', () => {
  it('returns all user media regardless of completedAt', async () => {
    const { token, userId } = await registerAndToken();

    await Media.create({
      mediaUploadedBy: new mongoose.Types.ObjectId(userId),
      filename: 'march.mp4',
      mediaType: 'VIDEO',
      format: 'mp4',
      status: 'COMPLETED',
      lengthMs: 180000,
      sizeBytes: 15_000_000,
      storage: { bucket: 'test', key: 'media/x/march.mp4', format: 'mp4' },
      completedAt: new Date('2026-03-16T12:00:00.000Z'),
    });

    const list = await request(app)
      .get('/api/media')
      .set('Authorization', `Bearer ${token}`)
      .query({ periodScope: 'all' });

    expect(list.statusCode).toBe(200);
    expect(list.body.total).toBe(1);

    const stats = await request(app)
      .get('/api/analytics/me')
      .set('Authorization', `Bearer ${token}`)
      .query({ periodScope: 'all' });

    expect(stats.statusCode).toBe(200);
    expect(stats.body.totalFiles).toBe(1);
    expect(stats.body.period).toBeNull();
  });
});
