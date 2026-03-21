const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../app');

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

describe('POST /api/auth/register', () => {
  it('creates a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'password123' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('assigns role=user for non-scriptify emails', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@gmail.com', password: 'password123' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects duplicate email', async () => {
    const payload = { name: 'Carol', email: 'carol@example.com', password: 'password123' };
    await request(app).post('/api/auth/register').send(payload);
    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toMatch(/already exists/i);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dave', email: 'dave@example.com', password: 'short' });

    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eve', email: 'not-an-email', password: 'password123' });

    expect(res.statusCode).toBe(400);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'frank@example.com', password: 'password123' });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'password123' });
  });

  it('returns a token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrongpassword' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toMatch(/invalid credentials/i);
  });

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toMatch(/invalid credentials/i);
  });
});
