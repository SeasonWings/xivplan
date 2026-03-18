const AppError = require('../errors/AppError');

module.exports = function createRateLimiter({ windowMs, max, keyFn, logger }) {
    const buckets = new Map();

    return (req, _res, next) => {
        try {
            const key = (keyFn ? keyFn(req) : req.ip) || 'unknown';
            const now = Date.now();
            const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

            if (now > bucket.resetAt) {
                bucket.count = 0;
                bucket.resetAt = now + windowMs;
            }

            bucket.count += 1;
            buckets.set(key, bucket);

            if (bucket.count > max) {
                logger.log('warn', 'http', 'http.rate_limited', { key, url: req.originalUrl });
                throw new AppError('请求过于频繁，请稍后再试', { status: 429, code: 'RATE_LIMITED' });
            }

            next();
        } catch (e) {
            next(e);
        }
    };
};
