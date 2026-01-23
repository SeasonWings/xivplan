const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { promisePool: pool } = require('../db');
const crypto = require('crypto');
const EmailService = require('../services/emailService');
const logger = require('../services/logger');

const router = express.Router();

// 创建邮件服务实例
const emailService = new EmailService();

// JWT密钥 - 应该从环境变量中获取
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';

// 生成用户ID
function generateUserId() {
    return 'user_' + crypto.randomBytes(16).toString('hex');
}

// 1. 请求发送注册验证码
router.post('/request-register-code', async (req, res) => {
    try {
        const { email } = req.body;
        logger.info('接收到注册验证码请求', { email });

        if (!email) {
            logger.warn('注册验证码请求失败：邮箱为空');
            return res.status(400).json({
                success: false,
                error: '邮箱不能为空',
            });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            logger.warn('注册验证码请求失败：邮箱格式不正确', { email });
            return res.status(400).json({
                success: false,
                error: '邮箱格式不正确',
            });
        }

        // 检查邮箱是否已存在
        const [existingUsers] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);

        if (existingUsers.length > 0) {
            logger.warn('注册验证码请求失败：邮箱已存在', { email });
            return res.status(409).json({
                success: false,
                error: '该邮箱已被注册',
            });
        }

        // 生成验证码
        const code = emailService.generateVerificationCode();

        // 设置30分钟后过期
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟

        // 存储验证码到数据库
        await pool.execute(
            `INSERT INTO verification_codes (email, code, type, expires_at) 
             VALUES (?, ?, 'register', ?)
             ON DUPLICATE KEY UPDATE 
             code = VALUES(code), 
             expires_at = VALUES(expires_at), 
             used = 0`,
            [email, code, expiresAt],
        );

        // 发送验证邮件
        const emailSent = await emailService.sendVerificationEmail(email, code, 'register');

        if (!emailSent) {
            logger.error('发送验证邮件失败', null, { email });
            return res.status(500).json({
                success: false,
                error: '发送验证邮件失败，请稍后重试',
            });
        }

        logger.info('注册验证码发送成功', { email });
        res.json({
            success: true,
            message: '验证码已发送，请查收邮件',
        });
    } catch (error) {
        logger.error('请求注册验证码异常', error);
        res.status(500).json({
            success: false,
            error: '发送验证码失败，请稍后重试',
        });
    }
});

// 2. 验证注册验证码
router.post('/verify-register-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        logger.info('接收到验证注册验证码请求', { email, code });

        if (!email || !code) {
            logger.warn('验证注册验证码失败：参数缺失');
            return res.status(400).json({
                success: false,
                error: '邮箱和验证码不能为空',
            });
        }

        // 查找未使用的有效验证码
        const [codes] = await pool.execute(
            `SELECT * FROM verification_codes 
             WHERE email = ? AND code = ? AND type = 'register' 
             AND expires_at > NOW() AND used = 0`,
            [email, code],
        );

        if (codes.length === 0) {
            logger.warn('验证注册验证码失败：验证码无效或已过期', { email, code });
            return res.status(400).json({
                success: false,
                error: '验证码无效或已过期',
            });
        }

        // 标记验证码为已使用
        await pool.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);

        logger.info('验证注册验证码成功', { email });
        res.json({
            success: true,
            message: '验证码验证成功',
        });
    } catch (error) {
        logger.error('验证注册验证码异常', error);
        res.status(500).json({
            success: false,
            error: '验证失败，请稍后重试',
        });
    }
});

// 3. 用户注册（带验证码验证）
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, verificationCode } = req.body;
        logger.info('接收到用户注册请求', { username, email });

        // 验证输入
        if (!username || !email || !password || !verificationCode) {
            logger.warn('用户注册失败：参数缺失');
            return res.status(400).json({
                success: false,
                error: '用户名、邮箱、密码和验证码都不能为空',
            });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            logger.warn('用户注册失败：邮箱格式不正确', { email });
            return res.status(400).json({
                success: false,
                error: '邮箱格式不正确',
            });
        }

        // 验证密码长度
        if (password.length < 6) {
            logger.warn('用户注册失败：密码长度不足', { username });
            return res.status(400).json({
                success: false,
                error: '密码长度至少为6位',
            });
        }

        // 验证用户名长度
        if (username.length < 3 || username.length > 20) {
            logger.warn('用户注册失败：用户名长度不合规', { username });
            return res.status(400).json({
                success: false,
                error: '用户名长度必须为3-20个字符',
            });
        }

        // 验证验证码
        const [codes] = await pool.execute(
            `SELECT * FROM verification_codes 
             WHERE email = ? AND code = ? AND type = 'register' 
             AND expires_at > NOW() AND used = 0`,
            [email, verificationCode],
        );

        if (codes.length === 0) {
            logger.warn('用户注册失败：验证码无效或已过期', { email });
            return res.status(400).json({
                success: false,
                error: '验证码无效或已过期',
            });
        }

        // 检查用户名或邮箱是否已存在（双重检查）
        const [existingUsers] = await pool.execute('SELECT user_id FROM users WHERE username = ? OR email = ?', [
            username,
            email,
        ]);

        if (existingUsers.length > 0) {
            logger.warn('用户注册失败：用户名或邮箱已存在', { username, email });
            return res.status(409).json({
                success: false,
                error: '用户名或邮箱已被注册',
            });
        }

        // 加密密码
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 生成用户ID
        const userId = generateUserId();

        // 插入新用户
        const [result] = await pool.execute(
            `INSERT INTO users (user_id, username, email, password_hash, email_verified) 
             VALUES (?, ?, ?, ?, TRUE)`,
            [userId, username, email, passwordHash],
        );

        // 标记验证码为已使用
        await pool.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);

        // 生成JWT token
        const token = jwt.sign({ userId: userId, username: username }, JWT_SECRET, { expiresIn: '7d' });

        logger.info('用户注册成功', { userId, username, email });
        // 返回成功响应（不包含敏感信息）
        res.json({
            success: true,
            message: '注册成功',
            token: token,
            user: {
                id: userId,
                username: username,
                email: email,
                emailVerified: true,
            },
        });
    } catch (error) {
        logger.error('用户注册异常', error);
        res.status(500).json({
            success: false,
            error: '注册失败，请稍后重试',
        });
    }
});

// 4. 用户登录（支持用户名或邮箱登录）
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier 可以是用户名或邮箱
        logger.info('接收到用户登录请求', { identifier });

        // 验证输入
        if (!identifier || !password) {
            logger.warn('用户登录失败：参数缺失');
            return res.status(400).json({
                success: false,
                error: '用户名/邮箱和密码不能为空',
            });
        }

        // 根据标识符类型查找用户（优先检查邮箱，然后是用户名）
        let userQuery = '';
        let queryParams = [];

        // 判断是否为邮箱格式
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

        if (isEmail) {
            userQuery = 'SELECT * FROM users WHERE email = ?';
            queryParams = [identifier];
        } else {
            userQuery = 'SELECT * FROM users WHERE username = ?';
            queryParams = [identifier];
        }

        const [users] = await pool.execute(userQuery, queryParams);

        if (users.length === 0) {
            logger.warn('用户登录失败：用户不存在', { identifier });
            return res.status(401).json({
                success: false,
                error: '用户名/邮箱或密码错误',
            });
        }

        const user = users[0];

        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            logger.warn('用户登录失败：密码错误', { identifier });
            return res.status(401).json({
                success: false,
                error: '用户名/邮箱或密码错误',
            });
        }

        // 更新最后登录时间
        await pool.execute('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

        // 生成JWT token
        const token = jwt.sign({ userId: user.user_id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

        logger.info('用户登录成功', { userId: user.user_id, username: user.username });
        // 返回成功响应（不包含密码等敏感信息）
        res.json({
            success: true,
            message: '登录成功',
            token: token,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                avatar: user.avatar || null,
                bio: user.bio || null,
                emailVerified: user.email_verified || false,
            },
        });
    } catch (error) {
        logger.error('用户登录异常', error);
        res.status(500).json({
            success: false,
            error: '登录失败，请稍后重试',
        });
    }
});

// 5. 用户登出（将token加入黑名单）
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        logger.info('接收到用户登出请求');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('用户登出失败：缺少认证头');
            return res.status(401).json({
                success: false,
                error: '缺少认证信息',
            });
        }

        const token = authHeader.substring(7);

        // 解码token获取过期时间
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            logger.warn('用户登出失败：Token无效');
            return res.status(400).json({
                success: false,
                error: 'Token无效',
            });
        }

        // 将token加入黑名单
        await pool.execute(
            `INSERT INTO blacklisted_tokens (token, expires_at) VALUES (?, FROM_UNIXTIME(?))
             ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
            [token, decoded.exp],
        );

        logger.info('用户登出成功', { userId: decoded.userId });
        res.json({
            success: true,
            message: '登出成功',
        });
    } catch (error) {
        logger.error('用户登出异常', error);
        res.status(500).json({
            success: false,
            error: '登出失败，请稍后重试',
        });
    }
});

// 6. 获取当前用户信息
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '缺少认证信息',
            });
        }

        const token = authHeader.substring(7);

        // 检查token是否在黑名单中
        const [blacklisted] = await pool.execute('SELECT * FROM blacklisted_tokens WHERE token = ?', [token]);

        if (blacklisted.length > 0) {
            return res.status(401).json({
                success: false,
                error: 'Token已被撤销',
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Token无效或已过期',
            });
        }

        // 获取用户信息
        const [users] = await pool.execute(
            'SELECT user_id, username, email, avatar, bio, role, is_verified, email_verified, created_at, updated_at FROM users WHERE user_id = ?',
            [decoded.userId],
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: '用户不存在',
            });
        }

        const user = users[0];

        res.json({
            success: true,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                avatar: user.avatar || null,
                bio: user.bio || null,
                role: user.role,
                isVerified: user.is_verified,
                emailVerified: user.email_verified,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
            },
        });
    } catch (error) {
        logger.error('获取用户信息异常', error);
        res.status(500).json({
            success: false,
            error: '获取用户信息失败，请稍后重试',
        });
    }
});

// 7. 更新用户信息（昵称、头像等）
router.put('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '缺少认证信息',
            });
        }

        const token = authHeader.substring(7);

        // 检查token是否在黑名单中
        const [blacklisted] = await pool.execute('SELECT * FROM blacklisted_tokens WHERE token = ?', [token]);

        if (blacklisted.length > 0) {
            return res.status(401).json({
                success: false,
                error: 'Token已被撤销',
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Token无效或已过期',
            });
        }

        const { username, avatar, bio } = req.body;

        // 验证头像数据大小（base64编码的图像可能很大）
        if (avatar && typeof avatar === 'string' && avatar.length > 1024 * 100) {
            // 限制为100KB
            return res.status(400).json({
                success: false,
                error: '头像图片过大，最大不能超过100KB',
            });
        }

        // 验证头像数据是否为有效的base64图像格式
        if (avatar && typeof avatar === 'string') {
            // 检查是否是有效的data URL格式
            if (avatar.startsWith('data:image/')) {
                // 验证基本的base64格式
                const base64Data = avatar.split(',')[1];
                if (base64Data) {
                    // 检查base64字符是否合法
                    const validBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                    if (!validBase64Regex.test(base64Data)) {
                        return res.status(400).json({
                            success: false,
                            error: '头像图片格式不正确',
                        });
                    }
                }
            } else if (!avatar.startsWith('http') && avatar !== null && avatar !== '') {
                // 如果不是URL也不是data URL，也不是空值或null，则拒绝
                return res.status(400).json({
                    success: false,
                    error: '头像格式不正确，必须是有效的图片URL或base64数据',
                });
            }
        }

        // 构建更新语句和参数
        let updateQuery = 'UPDATE users SET updated_at = NOW()';
        const params = [];

        if (username) {
            updateQuery += ', username = ?';
            params.push(username);
        }
        if (avatar !== undefined) {
            // avatar可以为null
            updateQuery += ', avatar = ?';
            params.push(avatar);
        }
        if (bio !== undefined) {
            // bio可以为null
            updateQuery += ', bio = ?';
            params.push(bio);
        }

        updateQuery += ' WHERE user_id = ?';
        params.push(decoded.userId);

        const [result] = await pool.execute(updateQuery, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: '用户不存在',
            });
        }

        // 获取更新后的用户信息
        const [users] = await pool.execute(
            'SELECT user_id, username, email, avatar, bio, role, is_verified, email_verified, created_at, updated_at FROM users WHERE user_id = ?',
            [decoded.userId],
        );

        res.json({
            success: true,
            message: '资料更新成功',
            user: {
                id: users[0].user_id,
                username: users[0].username,
                email: users[0].email,
                avatar: users[0].avatar || null,
                bio: users[0].bio || null,
                role: users[0].role,
                isVerified: users[0].is_verified,
                emailVerified: users[0].email_verified,
                createdAt: users[0].created_at,
                updatedAt: users[0].updated_at,
            },
        });
    } catch (error) {
        logger.error('更新用户资料异常', error);
        res.status(500).json({
            success: false,
            error: '更新资料失败',
        });
    }
});

// 8. 更改密码
router.put('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: '缺少认证信息',
            });
        }

        const token = authHeader.substring(7);

        // 检查token是否在黑名单中
        const [blacklisted] = await pool.execute('SELECT * FROM blacklisted_tokens WHERE token = ?', [token]);

        if (blacklisted.length > 0) {
            return res.status(401).json({
                success: false,
                error: 'Token已被撤销',
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Token无效或已过期',
            });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: '当前密码和新密码不能为空',
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: '新密码长度至少为6位',
            });
        }

        // 获取当前用户密码
        const [users] = await pool.execute('SELECT password_hash FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: '用户不存在',
            });
        }

        // 验证当前密码
        const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: '当前密码不正确',
            });
        }

        // 加密新密码
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // 更新密码
        await pool.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?', [
            newPasswordHash,
            decoded.userId,
        ]);

        res.json({
            success: true,
            message: '密码修改成功',
        });
    } catch (error) {
        logger.error('修改密码异常', error);
        res.status(500).json({
            success: false,
            error: '修改密码失败',
        });
    }
});

// 9. 请求发送重置密码验证码
router.post('/request-reset-password-code', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: '邮箱不能为空',
            });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: '邮箱格式不正确',
            });
        }

        // 检查邮箱是否存在
        const [users] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            // 为了安全考虑，即使邮箱不存在也返回成功消息
            return res.json({
                success: true,
                message: '如果邮箱存在，重置验证码已发送',
            });
        }

        // 生成验证码
        const code = emailService.generateVerificationCode();

        // 设置30分钟后过期
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟

        // 存储验证码到数据库
        await pool.execute(
            `INSERT INTO verification_codes (email, code, type, expires_at) 
             VALUES (?, ?, 'reset_password', ?)
             ON DUPLICATE KEY UPDATE 
             code = VALUES(code), 
             expires_at = VALUES(expires_at), 
             used = 0`,
            [email, code, expiresAt],
        );

        // 发送验证邮件
        const emailSent = await emailService.sendVerificationEmail(email, code, 'reset_password');

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                error: '发送验证邮件失败',
            });
        }

        res.json({
            success: true,
            message: '重置密码验证码已发送',
        });
    } catch (error) {
        logger.error('请求重置密码验证码异常', error);
        res.status(500).json({
            success: false,
            error: '发送重置密码验证码失败',
        });
    }
});

// 10. 验证重置密码验证码
router.post('/verify-reset-password-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                error: '邮箱和验证码不能为空',
            });
        }

        // 查找未使用的有效验证码
        const [codes] = await pool.execute(
            `SELECT * FROM verification_codes 
             WHERE email = ? AND code = ? AND type = 'reset_password' 
             AND expires_at > NOW() AND used = 0`,
            [email, code],
        );

        if (codes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification code',
            });
        }

        res.json({
            success: true,
            message: '验证码验证成功',
        });
    } catch (error) {
        logger.error('验证重置密码验证码异常', error);
        res.status(500).json({
            success: false,
            error: '验证失败',
        });
    }
});

// 11. 重置密码
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                error: '邮箱、验证码和新密码不能为空',
            });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: '邮箱格式不正确',
            });
        }

        // 验证新密码长度
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: '新密码长度至少为6位',
            });
        }

        // 首先验证验证码
        const [codes] = await pool.execute(
            `SELECT * FROM verification_codes 
             WHERE email = ? AND code = ? AND type = 'reset_password' 
             AND expires_at > NOW() AND used = 0`,
            [email, code],
        );

        if (codes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification code',
            });
        }

        // 获取用户信息
        const [users] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                error: '用户不存在',
            });
        }

        // 加密新密码
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // 更新用户密码
        await pool.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE email = ?', [
            newPasswordHash,
            email,
        ]);

        // 标记验证码为已使用
        await pool.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', [codes[0].id]);

        res.json({
            success: true,
            message: '密码重置成功',
        });
    } catch (error) {
        logger.error('重置密码异常', error);
        res.status(500).json({
            success: false,
            error: '重置密码失败',
        });
    }
});

module.exports = router;
