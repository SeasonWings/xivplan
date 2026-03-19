const COS = require('cos-nodejs-sdk-v5');
const crypto = require('crypto');
const path = require('path');

module.exports = function createUserAssetService({ userAssetRepository, cosConfig, logger }) {
    const cos = new COS({
        SecretId: cosConfig.secretId,
        SecretKey: cosConfig.secretKey,
    });

    return {
        async uploadAsset(userId, file, originalName) {
            // 1. 检查上传限制 (每个人10个)
            const count = await userAssetRepository.getAssetCountByUserId(userId);
            if (count >= 10) {
                throw new Error('Upload limit reached (max 10 images per user)');
            }

            // 2. 生成唯一文件名
            const ext = path.extname(originalName) || '.png';
            const randomName = crypto.randomBytes(16).toString('hex') + ext;
            const cosPath = `xivplan/user-assets/${userId}/${randomName}`;

            // 3. 上传到 COS
            return new Promise((resolve, reject) => {
                cos.putObject(
                    {
                        Bucket: cosConfig.bucket,
                        Region: cosConfig.region,
                        Key: cosPath,
                        Body: file.buffer,
                        onProgress: (progressData) => {
                            logger.debug('COS Upload Progress', progressData);
                        },
                    },
                    async (err, data) => {
                        if (err) {
                            logger.error('COS Upload Error', err);
                            return reject(err);
                        }

                        // 4. 获取访问 URL (如果有自定义域名则使用)
                        let assetUrl = `https://${cosConfig.bucket}.cos.${cosConfig.region}.myqcloud.com/${cosPath}`;
                        if (cosConfig.domain) {
                            assetUrl = `${cosConfig.domain}/${cosPath}`;
                        }

                        // 5. 保存到数据库
                        try {
                            const assetId = await userAssetRepository.addAsset(
                                userId,
                                assetUrl,
                                originalName,
                                file.size,
                            );
                            resolve({ id: assetId, url: assetUrl });
                        } catch (dbErr) {
                            logger.error('Database Error after COS upload', dbErr);
                            reject(dbErr);
                        }
                    },
                );
            });
        },

        async getUserAssets(userId) {
            return await userAssetRepository.getAssetsByUserId(userId);
        },

        async deleteAsset(userId, assetId) {
            const asset = await userAssetRepository.getAssetById(assetId);
            if (!asset || asset.user_id !== userId) {
                throw new Error('Asset not found or unauthorized');
            }

            // 1. 从 COS 删除
            let cosPath;
            if (cosConfig.domain) {
                const domainWithSlash = cosConfig.domain.endsWith('/') ? cosConfig.domain : `${cosConfig.domain}/`;
                cosPath = asset.asset_url.split(domainWithSlash)[1];
            } else {
                cosPath = asset.asset_url.split('.com/')[1];
            }

            if (!cosPath) {
                // Fallback if split failed
                logger.warn('Failed to extract cosPath from assetUrl', { assetUrl: asset.asset_url });
                // Attempt a last resort split
                const parts = asset.asset_url.split('/');
                cosPath = parts.slice(3).join('/'); // Skip protocol and domain
            }

            return new Promise((resolve, reject) => {
                cos.deleteObject(
                    {
                        Bucket: cosConfig.bucket,
                        Region: cosConfig.region,
                        Key: cosPath,
                    },
                    async (err, data) => {
                        if (err) {
                            logger.error('COS Delete Error', err);
                            return reject(err);
                        }

                        // 2. 从数据库删除
                        await userAssetRepository.deleteAsset(userId, assetId);
                        resolve(true);
                    },
                );
            });
        },
    };
};
