const { promisePool: pool } = require('../db');
const logger = require('../services/logger');

const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                error: '未授权访问',
            });
        }

        const [users] = await pool.execute('SELECT role FROM users WHERE user_id = ?', [req.user.userId]);

        if (users.length === 0 || users[0].role !== 'admin') {
            logger.warn('拒绝访问：非管理员用户尝试访问管理员接口', { userId: req.user.userId });
            return res.status(403).json({
                success: false,
                error: '需要管理员权限',
            });
        }

        next();
    } catch (error) {
        logger.error('管理员权限检查异常', error);
        return res.status(500).json({
            success: false,
            error: '服务器内部错误',
        });
    }
};

module.exports = { requireAdmin };
