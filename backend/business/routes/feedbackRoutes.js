const express = require('express');

module.exports = function createFeedbackRoutes({ feedbackController, authenticate, requireAdmin }) {
    const router = express.Router();

    router.post('/', feedbackController.submit);
    router.get('/', authenticate, requireAdmin, feedbackController.list);
    router.patch('/:id', authenticate, requireAdmin, feedbackController.update);

    return router;
};
