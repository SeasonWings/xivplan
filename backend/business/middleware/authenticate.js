const AppError = require('../errors/AppError');

module.exports = function createAuthenticateMiddleware({ jwt, jwtSecret, tokenBlacklistRepository, logger }) {
    return async (req, _res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AppError('缺少认证信息', { status: 401, code: 'UNAUTHORIZED' });
            }

            const token = authHeader.substring(7);
            const revoked = await tokenBlacklistRepository.isBlacklisted(token);
            if (revoked) {
                throw new AppError('Token已被撤销', { status: 401, code: 'TOKEN_REVOKED' });
            }

            const decoded = jwt.verify(token, jwtSecret);
            req.user = decoded;
            return next();
        } catch (e) {
            if (e instanceof AppError) {
                return next(e);
            }
            logger.log('warn', 'http', 'auth.token_invalid', { message: e?.message });
            return next(new AppError('Token无效或已过期', { status: 401, code: 'TOKEN_INVALID' }));
        }
    };
};
