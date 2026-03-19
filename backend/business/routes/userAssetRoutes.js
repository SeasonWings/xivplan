const express = require('express');

module.exports = function createUserAssetRoutes({ userAssetController, authenticate }) {
    const router = express.Router();

    // 所有路由都需要认证
    router.use(authenticate);

    // 获取用户已上传的自定义图案
    router.get('/', (req, res) => userAssetController.getAssets(req, res));

    // 上传自定义图案
    router.post('/upload', userAssetController.uploadMiddleware, (req, res) =>
        userAssetController.uploadAsset(req, res),
    );

    // 删除自定义图案
    router.delete('/:id', (req, res) => userAssetController.deleteAsset(req, res));

    return router;
};
