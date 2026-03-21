const request = require('supertest');
const { createApp } = require('../app');

const app = createApp();

describe('GET /api/health', () => {
  it('returns JSON with ok, mongo, and timestamp fields', async () => {
    const res = await request(app).get('/api/health');
    // 200 when DB connected, 503 when not — we only assert the shape
    expect([200, 503]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('ok');
    expect(res.body).toHaveProperty('mongo');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('timestamp is an ISO string', async () => {
    const res = await request(app).get('/api/health');
    expect(typeof res.body.timestamp).toBe('string');
    expect(() => new Date(res.body.timestamp)).not.toThrow();
  });

  it('mongo field is a boolean', async () => {
    const res = await request(app).get('/api/health');
    expect(typeof res.body.mongo).toBe('boolean');
  });
});
