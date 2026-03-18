const json = require('../views/json');

module.exports = function createFeedbackController({ feedbackService }) {
    return {
        submit: async (req, res, next) => {
            try {
                const created = await feedbackService.submitFeedback({
                    content: req.body?.content,
                    contactInfo: req.body?.contactInfo,
                    type: req.body?.type,
                    authHeader: req.headers?.authorization,
                });
                return json.message(res, '感谢您的反馈！', { feedbackId: created.id });
            } catch (e) {
                return next(e);
            }
        },

        list: async (req, res, next) => {
            try {
                const result = await feedbackService.listFeedback({
                    page: parseInt(req.query?.page) || 1,
                    limit: parseInt(req.query?.limit) || 20,
                    status: req.query?.status,
                });
                return res.json({ success: true, data: result.data, pagination: result.pagination });
            } catch (e) {
                return next(e);
            }
        },

        update: async (req, res, next) => {
            try {
                await feedbackService.updateFeedback({
                    id: req.params.id,
                    status: req.body?.status,
                    adminReply: req.body?.adminReply,
                });
                return json.message(res, '反馈状态更新成功');
            } catch (e) {
                return next(e);
            }
        },
    };
};
