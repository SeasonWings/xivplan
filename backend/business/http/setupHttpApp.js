const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');

const createCorsMiddleware = require('./corsMiddleware');
const createErrorHandler = require('../middleware/errorHandler');
const createRateLimiter = require('../middleware/rateLimit');
const buildOpenApi = require('../docs/openapi');

module.exports = function setupHttpApp(app, { baseDir, logger, routes }) {
    app.use(createCorsMiddleware(logger));
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
    app.use(logger.createMiddleware());

    const authLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 120,
        keyFn: (req) => `${req.ip}:${req.path}`,
        logger,
    });

    app.use('/api/auth', authLimiter, routes.auth);
    app.use('/api/community', routes.community);
    app.use('/api/feedback', routes.feedback);

    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/api/openapi.json', (_req, res) => {
        res.json(buildOpenApi({}));
    });

    app.get('/api/docs', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
            `<!doctype html><html><head><meta charset="utf-8"/><title>API Docs</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.ui=SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui'});</script></body></html>`,
        );
    });

    app.use(express.static(path.join(baseDir, 'dist')));
    app.use(createErrorHandler(logger));
};
