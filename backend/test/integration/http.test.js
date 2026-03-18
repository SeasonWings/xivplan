const request = require('supertest');

const createContainer = require('../../business/di/createContainer');
const createApp = require('../../business/http/createApp');

function createLoggerMock() {
    return {
        createMiddleware() {
            return (_req, _res, next) => next();
        },
        log: jest.fn(),
        ws: jest.fn(),
        generateId() {
            return 'id';
        },
    };
}

function createPoolMock() {
    return {
        execute: jest.fn(),
    };
}

describe('http integration', () => {
    test('GET /api/health', async () => {
        const pool = createPoolMock();
        const logger = createLoggerMock();
        const container = createContainer({
            pool,
            logger,
            env: { JWT_SECRET: 'test' },
            overrides: {
                emailClient: { generateVerificationCode: () => '000000', sendVerificationEmail: async () => true },
            },
        });
        const app = createApp({ baseDir: __dirname, logger, routes: container.routes });

        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('GET /api/openapi.json', async () => {
        const pool = createPoolMock();
        const logger = createLoggerMock();
        const container = createContainer({
            pool,
            logger,
            env: { JWT_SECRET: 'test' },
            overrides: {
                emailClient: { generateVerificationCode: () => '000000', sendVerificationEmail: async () => true },
            },
        });
        const app = createApp({ baseDir: __dirname, logger, routes: container.routes });

        const res = await request(app).get('/api/openapi.json');
        expect(res.status).toBe(200);
        expect(res.body.openapi).toBeDefined();
    });

    test('POST /api/feedback', async () => {
        const pool = createPoolMock();
        const logger = createLoggerMock();
        pool.execute.mockResolvedValueOnce([{ insertId: 1 }]);
        const container = createContainer({
            pool,
            logger,
            env: { JWT_SECRET: 'test' },
            overrides: {
                emailClient: { generateVerificationCode: () => '000000', sendVerificationEmail: async () => true },
            },
        });
        const app = createApp({ baseDir: __dirname, logger, routes: container.routes });

        const res = await request(app).post('/api/feedback').send({ content: 'hi', type: 'bug' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.feedbackId).toBe(1);
    });

    test('POST /api/auth/login accepts identifier field', async () => {
        const pool = createPoolMock();
        const logger = createLoggerMock();
        pool.execute.mockResolvedValueOnce([[]]);
        const container = createContainer({
            pool,
            logger,
            env: { JWT_SECRET: 'test' },
            overrides: {
                emailClient: { generateVerificationCode: () => '000000', sendVerificationEmail: async () => true },
            },
        });
        const app = createApp({ baseDir: __dirname, logger, routes: container.routes });

        const res = await request(app).post('/api/auth/login').send({ identifier: 'Maple', password: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    test('GET /api/auth/me uses top-level user field', async () => {
        const jwt = require('jsonwebtoken');
        const pool = createPoolMock();
        const logger = createLoggerMock();
        pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([
            [
                {
                    user_id: 'u1',
                    username: 'Maple',
                    email: 'm@x.com',
                    avatar: null,
                    bio: null,
                    role: 'user',
                    is_verified: 1,
                    email_verified: 1,
                    created_at: 'x',
                    updated_at: 'y',
                },
            ],
        ]);
        const container = createContainer({
            pool,
            logger,
            env: { JWT_SECRET: 'test' },
            overrides: {
                emailClient: { generateVerificationCode: () => '000000', sendVerificationEmail: async () => true },
            },
        });
        const app = createApp({ baseDir: __dirname, logger, routes: container.routes });

        const token = jwt.sign({ userId: 'u1', username: 'Maple', email: 'm@x.com', role: 'user' }, 'test', {
            expiresIn: '1h',
        });
        const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.username).toBe('Maple');
    });
});
