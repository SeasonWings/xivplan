const AppError = require('../errors/AppError');

module.exports = function createFeedbackService({ feedbackRepository, logger, jwt, jwtSecret }) {
    const validTypes = new Set(['suggestion', 'bug', 'other']);
    const validStatuses = new Set(['pending', 'read', 'resolved', 'ignored']);

    return {
        async submitFeedback({ content, contactInfo, type, authHeader }) {
            if (!content) {
                throw new AppError('反馈内容不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            }

            let userId = null;
            let username = null;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    const decoded = jwt.verify(token, jwtSecret);
                    userId = decoded.userId;
                    username = decoded.username;
                } catch {
                    logger.log('debug', 'http', 'feedback.token_invalid', {});
                }
            }

            const feedbackType = validTypes.has(type) ? type : 'suggestion';
            const created = await feedbackRepository.create({
                userId,
                username,
                content,
                contactInfo,
                type: feedbackType,
            });

            logger.log('info', 'http', 'feedback.created', { feedbackId: created.id, userId: userId || undefined });

            return created;
        },

        async listFeedback({ page, limit, status }) {
            const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
            const l = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;

            const result = await feedbackRepository.list({ page: p, limit: l, status });
            return {
                data: result.rows,
                pagination: {
                    current: p,
                    pageSize: l,
                    total: result.total,
                    totalPages: Math.ceil(result.total / l),
                },
            };
        },

        async updateFeedback({ id, status, adminReply }) {
            if (status && !validStatuses.has(status)) {
                throw new AppError('无效的状态', { status: 400, code: 'VALIDATION_ERROR' });
            }

            const { affectedRows } = await feedbackRepository.updateById(id, { status, adminReply });
            if (!affectedRows) {
                throw new AppError('反馈不存在', { status: 404, code: 'NOT_FOUND' });
            }
        },
    };
};
