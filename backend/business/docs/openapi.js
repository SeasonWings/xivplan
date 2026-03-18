module.exports = function buildOpenApi({ title = 'xivplan backend', version = '1.0.0' } = {}) {
    return {
        openapi: '3.0.3',
        info: { title, version },
        servers: [{ url: '/api' }],
        paths: {
            '/health': {
                get: {
                    summary: 'Health check',
                    responses: { 200: { description: 'OK' } },
                },
            },
            '/auth/login': {
                post: {
                    summary: 'Login',
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
                    responses: { 200: { description: 'OK' } },
                },
            },
            '/auth/register': {
                post: {
                    summary: 'Register',
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
                    responses: { 201: { description: 'Created' } },
                },
            },
            '/community/list': {
                get: { summary: 'List community plans', responses: { 200: { description: 'OK' } } },
            },
            '/community/{shareId}': {
                get: {
                    summary: 'Get community plan detail',
                    parameters: [{ name: 'shareId', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } },
                },
            },
            '/feedback': {
                post: { summary: 'Submit feedback', responses: { 200: { description: 'OK' } } },
            },
        },
    };
};
