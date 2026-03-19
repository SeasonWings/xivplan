module.exports = function getConfig(env = process.env) {
    const nodeEnv = env.NODE_ENV || 'development';
    return {
        nodeEnv,
        jwtSecret: env.JWT_SECRET || 'fallback_secret_key_for_development_only',
        port: env.PORT ? parseInt(env.PORT, 10) : 3001,
        enableMetrics: env.ENABLE_METRICS ? env.ENABLE_METRICS !== 'false' : true,
        cos: {
            secretId: env.COS_SECRET_ID,
            secretKey: env.COS_SECRET_KEY,
            bucket: env.COS_BUCKET,
            region: env.COS_REGION,
            domain: env.COS_DOMAIN, // Optional custom domain
        },
    };
};
