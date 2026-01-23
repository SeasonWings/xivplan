const express = require('express');
const router = express.Router();
const { promisePool: pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../services/logger');

// 生成唯一分享ID
function generateShareId() {
    return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36)
    ).substring(0, 32);
}

// 1. 上传战术板到社区
router.post('/upload', authenticateToken, async (req, res) => {
    try {
        const { title, description, sceneData, thumbnail, game, category, dungeonName, tags } = req.body;

        // 从认证的用户信息中获取用户名
        const username = req.user.username;

        logger.info('接收到上传战术板请求', { title, game, category, dungeonName, username });

        // 验证必填字段
        if (!title || !sceneData) {
            logger.warn('上传战术板失败：缺少必填字段');
            return res.status(400).json({ error: '缺少必填字段：标题和场景数据' });
        }

        const shareId = generateShareId();

        const finalGame = game || 'ff14';
        const finalCategory = category || 'ff14_general';
        logger.debug('保存游戏分类', { game: finalGame, category: finalCategory });

        const [result] = await pool.execute(
            `INSERT INTO plan_shares 
            (share_id, title, description, author, author_id, scene_data, thumbnail, game, category, dungeon_name, tags) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shareId,
                title,
                description || '',
                username,
                req.user.userId,
                sceneData,
                thumbnail || null,
                finalGame,
                finalCategory,
                dungeonName || null,
                tags ? JSON.stringify(tags) : null,
            ],
        );

        logger.info('战术板上传成功', { shareId, username });
        res.json({
            success: true,
            shareId,
            message: '战术板分享成功',
        });
    } catch (error) {
        logger.error('上传战术板异常', error);
        res.status(500).json({ error: '上传战术板失败，请稍后重试' });
    }
});

// 2. 获取战术板列表(支持分页、排序、筛选)
router.get('/list', async (req, res) => {
    try {
        const {
            page = 1,
            pageSize = 20,
            sortBy = 'created_at',
            order = 'DESC',
            game,
            category,
            search,
            dungeonName,
        } = req.query;

        // 添加调试日志
        logger.info('接收到获取战术板列表请求', { page, game, category, search, dungeonName });

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 构建WHERE条件
        let whereClause = 'WHERE status = 1';
        const params = [];

        // 游戏大类筛选
        if (game && game !== 'all') {
            whereClause += ' AND game = ?';
            params.push(game);
        }

        // 子分类筛选
        if (category && category !== 'all') {
            whereClause += ' AND category = ?';
            params.push(category);
        }

        if (dungeonName) {
            whereClause += ' AND dungeon_name LIKE ?';
            params.push(`%${dungeonName}%`);
        }

        if (search) {
            whereClause += ' AND (title LIKE ? OR description LIKE ? OR author LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // 验证排序字段
        const allowedSortFields = ['created_at', 'view_count', 'download_count', 'like_count'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // 获取总数
        const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM plan_shares ${whereClause}`, params);
        const total = countResult[0].total;

        // 获取列表数据
        const [rows] = await pool.execute(
            `SELECT 
                ps.share_id, ps.title, ps.description, u.username as author, ps.thumbnail, ps.game, ps.category, ps.dungeon_name, 
                ps.tags, ps.view_count, ps.download_count, ps.like_count, ps.created_at, ps.updated_at,
                u.avatar as author_avatar
            FROM plan_shares ps
            LEFT JOIN users u ON ps.author_id = u.user_id
            ${whereClause}
            ORDER BY ${sortField} ${sortOrder}
            LIMIT ? OFFSET ?`,
            [...params, limit, offset],
        );

        // 解析tags JSON
        const plans = rows.map((row) => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
        }));

        res.json({
            success: true,
            data: plans,
            pagination: {
                page: parseInt(page),
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error('获取战术板列表异常', error);
        res.status(500).json({ error: '获取战术板列表失败，请稍后重试' });
    }
});

// 3. 获取单个战术板详情
router.get('/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;

        const [rows] = await pool.execute(
            `SELECT 
                ps.*, 
                u.username as author,
                u.avatar as author_avatar
            FROM plan_shares ps
            LEFT JOIN users u ON ps.author_id = u.user_id
            WHERE ps.share_id = ? AND ps.status = 1`,
            [shareId],
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: '战术板不存在' });
        }

        // 计算总评论数（父评论 + 所有回复）
        const [commentCountResult] = await pool.execute(
            `SELECT COUNT(*) as total FROM plan_comments WHERE share_id = ? AND status = 1`,
            [shareId],
        );

        const plan = {
            ...rows[0],
            tags: rows[0].tags ? JSON.parse(rows[0].tags) : [],
            comment_count: commentCountResult[0].total, // 使用实际计算的总评论数
        };

        // 增加浏览次数
        await pool.execute(`UPDATE plan_shares SET view_count = view_count + 1 WHERE share_id = ?`, [shareId]);

        res.json({
            success: true,
            data: plan,
        });
    } catch (error) {
        logger.error('获取战术板异常', error);
        res.status(500).json({ error: '获取战术板失败，请稍后重试' });
    }
});

// 4. 下载战术板(增加下载次数)
router.post('/:shareId/download', async (req, res) => {
    try {
        const { shareId } = req.params;

        // 检查用户是否已认证
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const jwt = require('jsonwebtoken');
                const { pool } = require('../db');
                const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';

                // 检查token是否在黑名单中
                const [blacklisted] = await pool.execute('SELECT * FROM blacklisted_tokens WHERE token = ?', [token]);

                if (blacklisted.length === 0) {
                    // 如果不在黑名单中，则验证token
                    const decoded = jwt.verify(token, JWT_SECRET);
                    userId = decoded.userId;
                }
            } catch (error) {
                // Token无效，继续执行但不记录用户ID
                logger.debug('下载追踪Token无效', { error: error.message });
            }
        }

        await pool.execute(`UPDATE plan_shares SET download_count = download_count + 1 WHERE share_id = ?`, [shareId]);

        // TODO: 可以考虑记录下载历史，但目前只增加计数

        res.json({
            success: true,
            message: '下载次数已更新',
        });
    } catch (error) {
        logger.error('更新下载次数异常', error);
        res.status(500).json({ error: '更新下载次数失败' });
    }
});

// 5. 点赞/取消点赞
router.post('/:shareId/like', async (req, res) => {
    try {
        const { shareId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: '用户ID不能为空' });
        }

        // 检查是否已点赞
        const [existing] = await pool.execute(`SELECT * FROM plan_likes WHERE share_id = ? AND user_id = ?`, [
            shareId,
            userId,
        ]);

        if (existing.length > 0) {
            // 取消点赞
            await pool.execute(`DELETE FROM plan_likes WHERE share_id = ? AND user_id = ?`, [shareId, userId]);
            await pool.execute(`UPDATE plan_shares SET like_count = like_count - 1 WHERE share_id = ?`, [shareId]);

            res.json({
                success: true,
                liked: false,
                message: '已取消点赞',
            });
        } else {
            // 添加点赞
            await pool.execute(`INSERT INTO plan_likes (share_id, user_id) VALUES (?, ?)`, [shareId, userId]);
            await pool.execute(`UPDATE plan_shares SET like_count = like_count + 1 WHERE share_id = ?`, [shareId]);

            res.json({
                success: true,
                liked: true,
                message: '已点赞',
            });
        }
    } catch (error) {
        logger.error('点赞操作异常', error);
        res.status(500).json({ error: '点赞操作失败，请稍后重试' });
    }
});

// 6. 检查用户是否已点赞
router.get('/:shareId/like/:userId', async (req, res) => {
    try {
        const { shareId, userId } = req.params;

        const [rows] = await pool.execute(`SELECT * FROM plan_likes WHERE share_id = ? AND user_id = ?`, [
            shareId,
            userId,
        ]);

        res.json({
            success: true,
            liked: rows.length > 0,
        });
    } catch (error) {
        logger.error('检查点赞状态异常', error);
        res.status(500).json({ error: '检查点赞状态失败' });
    }
});

// 7. 获取分类统计
router.get('/stats/categories', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT category, COUNT(*) as count FROM plan_shares WHERE status = 1 GROUP BY category`,
        );

        res.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        logger.error('获取分类统计异常', error);
        res.status(500).json({ error: '获取分类统计失败' });
    }
});

// 8. 举报战术板
router.post('/:shareId/report', async (req, res) => {
    try {
        const { shareId } = req.params;
        const { userId, reason } = req.body;

        if (!userId || !reason) {
            return res.status(400).json({ error: '用户ID和举报原因不能为空' });
        }

        await pool.execute(`INSERT INTO plan_reports (share_id, user_id, reason) VALUES (?, ?, ?)`, [
            shareId,
            userId,
            reason,
        ]);

        res.json({
            success: true,
            message: '举报提交成功',
        });
    } catch (error) {
        logger.error('提交举报异常', error);
        res.status(500).json({ error: '提交举报失败，请稍后重试' });
    }
});

// ==================== 评论相关 API ====================

// 9. 获取战术板评论列表
router.get('/:shareId/comments', async (req, res) => {
    try {
        const { shareId } = req.params;
        const { page = 1, pageSize = 20, order = 'desc' } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 验证排序参数
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

        // 获取总数
        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total FROM plan_comments WHERE share_id = ? AND status = 1 AND parent_id IS NULL`,
            [shareId],
        );
        const total = countResult[0].total;

        // 获取父评论列表（按时间排序）
        const [parentComments] = await pool.execute(
            `SELECT 
                c.id, c.share_id, c.user_id, c.user_name, c.user_avatar, 
                c.content, c.created_at, c.updated_at
            FROM plan_comments c
            WHERE c.share_id = ? AND c.status = 1 AND c.parent_id IS NULL
            ORDER BY c.created_at ${sortOrder}
            LIMIT ? OFFSET ?`,
            [shareId, limit, offset],
        );

        // 获取每个父评论的回复（最新1条）
        const commentsWithReplies = await Promise.all(
            parentComments.map(async (comment) => {
                const [replies] = await pool.execute(
                    `SELECT 
                        c.id, c.user_id, c.user_name, c.user_avatar, 
                        c.content, c.reply_to_user_id, c.reply_to_user_name,
                        c.created_at, c.updated_at
                    FROM plan_comments c
                    WHERE c.parent_id = ? AND c.status = 1
                    ORDER BY c.created_at ASC
                    LIMIT 1`,
                    [comment.id],
                );

                // 获取总回复数
                const [replyCountResult] = await pool.execute(
                    `SELECT COUNT(*) as count FROM plan_comments WHERE parent_id = ? AND status = 1`,
                    [comment.id],
                );

                return {
                    ...comment,
                    replies: replies,
                    replyCount: replyCountResult[0].count,
                };
            }),
        );

        res.json({
            success: true,
            data: commentsWithReplies,
            pagination: {
                page: parseInt(page),
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error('获取评论列表异常', error);
        res.status(500).json({ error: '获取评论列表失败，请稍后重试' });
    }
});

// 10. 获取单个评论的所有回复
router.get('/:shareId/comments/:commentId/replies', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { page = 1, pageSize = 20 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 获取总数
        const [countResult] = await pool.execute(
            `SELECT COUNT(*) as total FROM plan_comments WHERE parent_id = ? AND status = 1`,
            [commentId],
        );
        const total = countResult[0].total;

        // 获取回复列表
        const [replies] = await pool.execute(
            `SELECT 
                c.id, c.user_id, c.user_name, c.user_avatar, 
                c.content, c.reply_to_user_id, c.reply_to_user_name,
                c.created_at, c.updated_at
            FROM plan_comments c
            WHERE c.parent_id = ? AND c.status = 1
            ORDER BY c.created_at ASC
            LIMIT ? OFFSET ?`,
            [commentId, limit, offset],
        );

        res.json({
            success: true,
            data: replies,
            pagination: {
                page: parseInt(page),
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error('获取评论回复异常', error);
        res.status(500).json({ error: '获取评论回复失败，请稍后重试' });
    }
});

// 11. 发表评论或回复
router.post('/:shareId/comments', authenticateToken, async (req, res) => {
    try {
        const { shareId } = req.params;
        const { content, parentId, replyToUserId, replyToUserName } = req.body;

        logger.info('接收到发表评论请求', { shareId, userId: req.user.userId, content: content?.substring(0, 20) });

        // 验证必填字段
        if (!content || content.trim().length === 0) {
            logger.warn('发表评论失败：内容为空');
            return res.status(400).json({ error: '评论内容不能为空' });
        }

        if (content.length > 100) {
            logger.warn('发表评论失败：内容过长');
            return res.status(400).json({ error: '评论内容不能超过100个字符' });
        }

        // 获取用户完整信息（包括头像）
        const [userRows] = await pool.execute(`SELECT user_id, username, avatar FROM users WHERE user_id = ?`, [
            req.user.userId,
        ]);

        if (userRows.length === 0) {
            logger.warn('发表评论失败：用户不存在', { userId: req.user.userId });
            return res.status(404).json({ error: '用户不存在' });
        }

        const user = userRows[0];

        // 验证战术板是否存在
        const [planRows] = await pool.execute(`SELECT id FROM plan_shares WHERE share_id = ? AND status = 1`, [
            shareId,
        ]);

        if (planRows.length === 0) {
            logger.warn('发表评论失败：战术板不存在', { shareId });
            return res.status(404).json({ error: '战术板不存在' });
        }

        // 如果是回复，验证父评论是否存在
        if (parentId) {
            const [parentRows] = await pool.execute(
                `SELECT id FROM plan_comments WHERE id = ? AND share_id = ? AND status = 1`,
                [parentId, shareId],
            );

            if (parentRows.length === 0) {
                logger.warn('发表评论失败：父评论不存在', { parentId, shareId });
                return res.status(404).json({ error: '父评论不存在' });
            }
        }

        // 插入评论
        const [result] = await pool.execute(
            `INSERT INTO plan_comments 
            (share_id, user_id, user_name, user_avatar, content, parent_id, reply_to_user_id, reply_to_user_name) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shareId,
                user.user_id,
                user.username,
                user.avatar || null,
                content.trim(),
                parentId || null,
                replyToUserId || null,
                replyToUserName || null,
            ],
        );

        // 更新战术板的评论数（父评论 + 回复）
        await pool.execute(`UPDATE plan_shares SET comment_count = comment_count + 1 WHERE share_id = ?`, [shareId]);

        // 获取刚刚插入的评论
        const [newComment] = await pool.execute(
            `SELECT 
                id, share_id, user_id, user_name, user_avatar, 
                content, parent_id, reply_to_user_id, reply_to_user_name,
                created_at, updated_at
            FROM plan_comments WHERE id = ?`,
            [result.insertId],
        );

        logger.info('评论发表成功', {
            shareId,
            userId: user.user_id,
            commentId: result.insertId,
            isReply: !!parentId,
        });

        res.json({
            success: true,
            data: newComment[0],
            message: parentId ? '回复成功' : '评论成功',
        });
    } catch (error) {
        logger.error('发表评论异常', error);
        res.status(500).json({ error: '发表评论失败，请稍后重试' });
    }
});

// 12. 删除评论（仅限自己的评论）
router.delete('/:shareId/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { shareId, commentId } = req.params;

        // 验证评论是否存在且属于当前用户
        const [rows] = await pool.execute(
            `SELECT id, user_id, parent_id FROM plan_comments WHERE id = ? AND share_id = ? AND status = 1`,
            [commentId, shareId],
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: '评论不存在' });
        }

        const comment = rows[0];

        // 检查权限（只能删除自己的评论）
        if (comment.user_id !== req.user.userId) {
            return res.status(403).json({ error: '没有权限删除此评论' });
        }

        // 软删除评论
        await pool.execute(`UPDATE plan_comments SET status = 0 WHERE id = ?`, [commentId]);

        // 更新战术板的评论数（包括父评论和回复）
        await pool.execute(`UPDATE plan_shares SET comment_count = GREATEST(comment_count - 1, 0) WHERE share_id = ?`, [
            shareId,
        ]);

        logger.info('评论删除成功', {
            shareId,
            userId: req.user.userId,
            commentId,
        });

        res.json({
            success: true,
            message: '评论删除成功',
        });
    } catch (error) {
        logger.error('删除评论异常', error);
        res.status(500).json({ error: '删除评论失败，请稍后重试' });
    }
});

module.exports = router;
