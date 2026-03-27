const express = require('express');

module.exports = function createConfigRoutes({ configController }) {
    const router = express.Router();

    // 所有人都可以获取 COS 配置，以便前端替换 URL
    router.get('/cos', configController.getCosConfig);

    return router;
};
