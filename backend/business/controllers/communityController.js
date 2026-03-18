module.exports = function createCommunityController({ communityService }) {
    return {
        upload: async (req, res, next) => {
            try {
                const { shareId } = await communityService.upload({ user: req.user, body: req.body });
                return res.json({ success: true, shareId, message: '战术板分享成功' });
            } catch (e) {
                return next(e);
            }
        },

        list: async (req, res, next) => {
            try {
                const { plans, pagination } = await communityService.list(req.query);
                return res.json({ success: true, data: plans, pagination });
            } catch (e) {
                return next(e);
            }
        },

        detail: async (req, res, next) => {
            try {
                const plan = await communityService.getDetail(req.params.shareId);
                return res.json({ success: true, data: plan });
            } catch (e) {
                return next(e);
            }
        },

        download: async (req, res, next) => {
            try {
                await communityService.download(req.params.shareId, req.headers.authorization);
                return res.json({ success: true, message: '下载次数已更新' });
            } catch (e) {
                return next(e);
            }
        },

        like: async (req, res, next) => {
            try {
                const { liked, message } = await communityService.toggleLike(req.params.shareId, req.body?.userId);
                return res.json({ success: true, liked, message });
            } catch (e) {
                return next(e);
            }
        },

        likeStatus: async (req, res, next) => {
            try {
                const { liked } = await communityService.checkLiked(req.params.shareId, req.params.userId);
                return res.json({ success: true, liked });
            } catch (e) {
                return next(e);
            }
        },

        categoryStats: async (_req, res, next) => {
            try {
                const rows = await communityService.categoryStats();
                return res.json({ success: true, data: rows });
            } catch (e) {
                return next(e);
            }
        },

        report: async (req, res, next) => {
            try {
                await communityService.report(req.params.shareId, req.body);
                return res.json({ success: true, message: '举报提交成功' });
            } catch (e) {
                return next(e);
            }
        },

        comments: async (req, res, next) => {
            try {
                const { comments, pagination } = await communityService.listComments(req.params.shareId, req.query);
                return res.json({ success: true, data: comments, pagination });
            } catch (e) {
                return next(e);
            }
        },

        replies: async (req, res, next) => {
            try {
                const { replies, pagination } = await communityService.listReplies(req.params.commentId, req.query);
                return res.json({ success: true, data: replies, pagination });
            } catch (e) {
                return next(e);
            }
        },

        addComment: async (req, res, next) => {
            try {
                const { comment, message } = await communityService.addComment(
                    req.params.shareId,
                    req.user.userId,
                    req.body,
                );
                return res.json({ success: true, data: comment, message });
            } catch (e) {
                return next(e);
            }
        },

        deleteComment: async (req, res, next) => {
            try {
                await communityService.deleteComment(req.params.shareId, req.params.commentId, req.user.userId);
                return res.json({ success: true, message: '评论删除成功' });
            } catch (e) {
                return next(e);
            }
        },
    };
};
