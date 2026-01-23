const jwt = require('jsonwebtoken');
const { promisePool: pool } = require('../db');
const logger = require('../services/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';

// 验证JWT令牌的中间件
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('认证失败：缺少认证头');
        return res.status(401).json({
            success: false,
            error: '缺少认证信息',
        });
    }

    const token = authHeader.substring(7);

    try {
        // 检查token是否在黑名单中
        const [blacklisted] = await pool.execute('SELECT * FROM blacklisted_tokens WHERE token = ?', [token]);

        if (blacklisted.length > 0) {
            logger.warn('认证失败：Token已被撤销');
            return res.status(401).json({
                success: false,
                error: 'Token已被撤销',
            });
        }

        // 验证token
        const decoded = jwt.verify(token, JWT_SECRET);

        // 将用户信息附加到请求对象
        req.user = decoded;

        next();
    } catch (error) {
        logger.warn('认证失败：Token无效或已过期', { error: error.message });
        return res.status(401).json({
            success: false,
            error: 'Token无效或已过期',
        });
    }
};

module.exports = { authenticateToken };
