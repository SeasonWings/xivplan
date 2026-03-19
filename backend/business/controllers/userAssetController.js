const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

module.exports = function createUserAssetController({ userAssetService, logger }) {
    return {
        async uploadAsset(req, res) {
            const userId = req.user.userId;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                const result = await userAssetService.uploadAsset(userId, file, file.originalname);
                res.status(201).json(result);
            } catch (err) {
                logger.error('Asset Upload Controller Error', err);
                if (err.message.includes('limit reached')) {
                    return res.status(403).json({ error: err.message });
                }
                res.status(500).json({ error: 'Failed to upload asset' });
            }
        },

        async getAssets(req, res) {
            const userId = req.user.userId;

            try {
                const assets = await userAssetService.getUserAssets(userId);
                res.json({ assets });
            } catch (err) {
                logger.error('Asset Get Controller Error', err);
                res.status(500).json({ error: 'Failed to get assets' });
            }
        },

        async deleteAsset(req, res) {
            const userId = req.user.userId;
            const assetId = req.params.id;

            try {
                await userAssetService.deleteAsset(userId, assetId);
                res.status(204).end();
            } catch (err) {
                logger.error('Asset Delete Controller Error', err);
                res.status(500).json({ error: 'Failed to delete asset' });
            }
        },

        uploadMiddleware: upload.single('image'),
    };
};
