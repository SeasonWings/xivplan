const AppError = require('../errors/AppError');
const { toPlanListItem, toPlanDetail } = require('../views/communityView');

module.exports = function createCommunityService({
    communityRepository,
    tokenBlacklistRepository,
    jwt,
    jwtSecret,
    logger,
}) {
    function generateShareId() {
        return (
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15) +
            Date.now().toString(36)
        ).substring(0, 32);
    }

    return {
        async upload({ user, body }) {
            const { title, description, sceneData, thumbnail, game, category, dungeonName, tags } = body || {};
            const username = user?.username;
            if (!title || !sceneData) {
                throw new AppError('缺少必填字段：标题和场景数据', { status: 400, code: 'VALIDATION_ERROR' });
            }

            const shareId = generateShareId();
            const finalGame = game || 'ff14';
            const finalCategory = category || 'ff14_general';

            await communityRepository.createShare({
                shareId,
                title,
                description: description || '',
                author: username,
                authorId: user.userId,
                sceneData,
                thumbnail,
                game: finalGame,
                category: finalCategory,
                dungeonName: dungeonName || null,
                tagsJson: tags ? JSON.stringify(tags) : null,
            });

            logger.log('info', 'http', 'community.upload', {
                shareId,
                userId: user.userId,
                game: finalGame,
                category: finalCategory,
            });
            return { shareId };
        },

        async list(query) {
            const {
                page = 1,
                pageSize = 20,
                sortBy = 'created_at',
                order = 'DESC',
                game,
                category,
                search,
                dungeonName,
            } = query || {};

            const p = parseInt(page) || 1;
            const limit = parseInt(pageSize) || 20;
            const offset = (p - 1) * limit;

            let whereClause = 'WHERE status = 1';
            const params = [];

            if (game && game !== 'all') {
                whereClause += ' AND game = ?';
                params.push(game);
            }
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

            const allowedSortFields = ['created_at', 'view_count', 'download_count', 'like_count'];
            const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
            const sortOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const total = await communityRepository.countShares({ whereClause, params });
            const rows = await communityRepository.listShares({
                whereClause,
                params,
                sortField,
                sortOrder,
                limit,
                offset,
            });
            const plans = rows.map(toPlanListItem);

            return {
                plans,
                pagination: {
                    page: p,
                    pageSize: limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        },

        async getDetail(shareId) {
            const plan = await communityRepository.getShareById(shareId);
            if (!plan) throw new AppError('战术板不存在', { status: 404, code: 'NOT_FOUND' });

            const commentCount = await communityRepository.countCommentsByShareId(shareId);
            await communityRepository.incrementView(shareId);

            return toPlanDetail(plan, commentCount);
        },

        async download(shareId, authHeader) {
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.substring(7);
                    const revoked = await tokenBlacklistRepository.isBlacklisted(token);
                    if (!revoked) {
                        jwt.verify(token, jwtSecret);
                    }
                } catch (e) {
                    logger.log('debug', 'http', 'community.download.token_invalid', { message: e?.message });
                }
            }
            await communityRepository.incrementDownload(shareId);
        },

        async toggleLike(shareId, userId) {
            if (!userId) throw new AppError('用户ID不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            const existing = await communityRepository.findLike(shareId, userId);
            if (existing) {
                await communityRepository.removeLike(shareId, userId);
                return { liked: false, message: '已取消点赞' };
            }
            await communityRepository.addLike(shareId, userId);
            return { liked: true, message: '已点赞' };
        },

        async checkLiked(shareId, userId) {
            const existing = await communityRepository.findLike(shareId, userId);
            return { liked: Boolean(existing) };
        },

        async categoryStats() {
            return await communityRepository.getCategoryStats();
        },

        async report(shareId, { userId, reason }) {
            if (!userId || !reason)
                throw new AppError('用户ID和举报原因不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            await communityRepository.addReport(shareId, userId, reason);
        },

        async listComments(shareId, query) {
            const { page = 1, pageSize = 20, order = 'desc' } = query || {};
            const p = parseInt(page) || 1;
            const limit = parseInt(pageSize) || 20;
            const offset = (p - 1) * limit;
            const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

            const total = await communityRepository.countParentComments(shareId);
            const parents = await communityRepository.listParentComments(shareId, { sortOrder, limit, offset });
            const commentsWithReplies = await Promise.all(
                parents.map(async (comment) => {
                    const replies = await communityRepository.listLatestReply(comment.id);
                    const replyCount = await communityRepository.countReplies(comment.id);
                    return { ...comment, replies, replyCount };
                }),
            );

            return {
                comments: commentsWithReplies,
                pagination: {
                    page: p,
                    pageSize: limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        },

        async listReplies(commentId, query) {
            const { page = 1, pageSize = 20 } = query || {};
            const p = parseInt(page) || 1;
            const limit = parseInt(pageSize) || 20;
            const offset = (p - 1) * limit;
            const total = await communityRepository.countReplies(commentId);
            const replies = await communityRepository.listReplies(commentId, { limit, offset });
            return {
                replies,
                pagination: { page: p, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
            };
        },

        async addComment(shareId, userId, body) {
            const { content, parentId, replyToUserId, replyToUserName } = body || {};
            if (!content || content.trim().length === 0) {
                throw new AppError('评论内容不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            }
            if (content.length > 100) {
                throw new AppError('评论内容不能超过100个字符', { status: 400, code: 'VALIDATION_ERROR' });
            }

            const user = await communityRepository.getUserBasic(userId);
            if (!user) throw new AppError('用户不存在', { status: 404, code: 'NOT_FOUND' });

            const exists = await communityRepository.shareExists(shareId);
            if (!exists) throw new AppError('战术板不存在', { status: 404, code: 'NOT_FOUND' });

            if (parentId) {
                const ok = await communityRepository.parentCommentExists(parentId, shareId);
                if (!ok) throw new AppError('父评论不存在', { status: 404, code: 'NOT_FOUND' });
            }

            const created = await communityRepository.createComment({
                shareId,
                userId: user.user_id,
                userName: user.username,
                userAvatar: user.avatar,
                content: content.trim(),
                parentId,
                replyToUserId,
                replyToUserName,
            });
            await communityRepository.incrementCommentCount(shareId);
            const newComment = await communityRepository.getCommentById(created.id);
            return { comment: newComment, message: parentId ? '回复成功' : '评论成功' };
        },

        async deleteComment(shareId, commentId, userId) {
            const comment = await communityRepository.getActiveCommentForDelete(commentId, shareId);
            if (!comment) throw new AppError('评论不存在', { status: 404, code: 'NOT_FOUND' });
            if (comment.user_id !== userId)
                throw new AppError('没有权限删除此评论', { status: 403, code: 'FORBIDDEN' });
            await communityRepository.softDeleteComment(commentId);
            await communityRepository.decrementCommentCount(shareId);
        },
    };
};
