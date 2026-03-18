const AppError = require('../errors/AppError');

module.exports = function createRequireAdminMiddleware({ userRepository, logger }) {
    return async (req, _res, next) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                throw new AppError('未授权访问', { status: 401, code: 'UNAUTHORIZED' });
            }

            const user = await userRepository.findPublicById(userId);
            if (!user || user.role !== 'admin') {
                logger.log('warn', 'http', 'auth.admin_forbidden', { userId });
                throw new AppError('需要管理员权限', { status: 403, code: 'FORBIDDEN' });
            }

            return next();
        } catch (e) {
            return next(e);
        }
    };
};
