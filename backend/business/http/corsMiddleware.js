module.exports = function createCorsMiddleware(logger) {
    return (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        logger.log('debug', 'http', 'http.cors', {
            method: req.method,
            url: req.url,
            origin: req.headers.origin || 'no-origin',
        });

        if (req.method === 'OPTIONS') {
            logger.log('debug', 'http', 'http.cors_preflight', { method: req.method, url: req.url });
            return res.status(200).end();
        }

        next();
    };
};
