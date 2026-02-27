const express = require('express');
const { promisePool: pool } = require('../db');
const logger = require('../services/logger');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';

// 1. 提交反馈 (Public)
router.post('/', async (req, res) => {
    try {
        const { content, contactInfo, type } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: '反馈内容不能为空',
            });
        }

        let userId = null;
        let username = null;

        // 尝试从Token获取用户信息 (可选)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
                username = decoded.username;
            } catch (err) {
                // Token无效忽略，作为匿名用户处理
                logger.debug('反馈提交：Token无效，作为匿名用户处理');
            }
        }

        const validTypes = ['suggestion', 'bug', 'other'];
        const feedbackType = validTypes.includes(type) ? type : 'suggestion';

        const [result] = await pool.execute(
            `INSERT INTO feedback (user_id, username, content, contact_info, type) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, username, content, contactInfo || null, feedbackType],
        );

        logger.info('收到新反馈', { feedbackId: result.insertId, userId });

        res.json({
            success: true,
            message: '感谢您的反馈！',
            feedbackId: result.insertId,
        });
    } catch (error) {
        logger.error('提交反馈异常', error);
        res.status(500).json({
            success: false,
            error: '提交反馈失败，请稍后重试',
        });
    }
});

// 2. 获取反馈列表 (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;

        let query = 'SELECT * FROM feedback';
        let countQuery = 'SELECT COUNT(*) as total FROM feedback';
        let params = [];

        if (status) {
            query += ' WHERE status = ?';
            countQuery += ' WHERE status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.execute(query, params);
        const [countResult] = await pool.execute(countQuery, status ? [status] : []);

        const total = countResult[0].total;

        res.json({
            success: true,
            data: rows,
            pagination: {
                current: page,
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error('获取反馈列表异常', error);
        res.status(500).json({
            success: false,
            error: '获取反馈列表失败',
        });
    }
});

// 3. 更新反馈状态 (Admin only)
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminReply } = req.body;

        const validStatuses = ['pending', 'read', 'resolved', 'ignored'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: '无效的状态',
            });
        }

        let query = 'UPDATE feedback SET updated_at = NOW()';
        let params = [];

        if (status) {
            query += ', status = ?';
            params.push(status);
        }

        if (adminReply !== undefined) {
            query += ', admin_reply = ?';
            params.push(adminReply);
        }

        query += ' WHERE id = ?';
        params.push(id);

        const [result] = await pool.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: '反馈不存在',
            });
        }

        res.json({
            success: true,
            message: '反馈状态更新成功',
        });
    } catch (error) {
        logger.error('更新反馈状态异常', error);
        res.status(500).json({
            success: false,
            error: '更新反馈状态失败',
        });
    }
});

module.exports = router;
