const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../app');

test('GET /api/health returns mongo status and timestamp', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.type, 'application/json');
    assert.ok(typeof res.body.mongo === 'boolean');
    assert.ok(res.body.timestamp);
});
