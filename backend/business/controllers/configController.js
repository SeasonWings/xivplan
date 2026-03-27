module.exports = function createConfigController({ cosConfig }) {
    return {
        async getCosConfig(req, res, next) {
            try {
                // 使用环境变量中的配置作为默认值
                return res.json({
                    baseUrl: cosConfig.baseUrl || '',
                    enabled: !!cosConfig.baseUrl,
                });
            } catch (err) {
                next(err);
            }
        },
    };
};
