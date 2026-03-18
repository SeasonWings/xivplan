const express = require('express');

module.exports = function createCommunityRoutes({ communityController, authenticate }) {
    const router = express.Router();

    router.post('/upload', authenticate, communityController.upload);
    router.get('/list', communityController.list);
    router.get('/stats/categories', communityController.categoryStats);
    router.get('/:shareId', communityController.detail);
    router.post('/:shareId/download', communityController.download);
    router.post('/:shareId/like', communityController.like);
    router.get('/:shareId/like/:userId', communityController.likeStatus);
    router.post('/:shareId/report', communityController.report);
    router.get('/:shareId/comments', communityController.comments);
    router.get('/:shareId/comments/:commentId/replies', communityController.replies);
    router.post('/:shareId/comments', authenticate, communityController.addComment);
    router.delete('/:shareId/comments/:commentId', authenticate, communityController.deleteComment);

    return router;
};
