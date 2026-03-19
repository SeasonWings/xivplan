const jwt = require('jsonwebtoken');

const getConfig = require('../config');
const createEmailClient = require('../external/emailClient');
const createCommunityRepository = require('../models/communityRepository');
const createUserRepository = require('../models/userRepository');
const createVerificationCodeRepository = require('../models/verificationCodeRepository');
const createFeedbackRepository = require('../models/feedbackRepository');
const createTokenBlacklistRepository = require('../models/tokenBlacklistRepository');
const createUserAssetRepository = require('../models/userAssetRepository');
const createAuthService = require('../services/authService');
const createCommunityService = require('../services/communityService');
const createFeedbackService = require('../services/feedbackService');
const createUserAssetService = require('../services/userAssetService');
const createAuthController = require('../controllers/authController');
const createCommunityController = require('../controllers/communityController');
const createFeedbackController = require('../controllers/feedbackController');
const createUserAssetController = require('../controllers/userAssetController');
const createAuthRoutes = require('../routes/authRoutes');
const createCommunityRoutes = require('../routes/communityRoutes');
const createFeedbackRoutes = require('../routes/feedbackRoutes');
const createUserAssetRoutes = require('../routes/userAssetRoutes');
const createAuthenticate = require('../middleware/authenticate');
const createRequireAdmin = require('../middleware/requireAdmin');

module.exports = function createContainer({ pool, logger, env, overrides }) {
    const config = getConfig(env);
    const o = overrides || {};

    const repositories = {
        community: createCommunityRepository(pool),
        feedback: createFeedbackRepository(pool),
        tokenBlacklist: createTokenBlacklistRepository(pool),
        user: createUserRepository(pool),
        verificationCode: createVerificationCodeRepository(pool),
        userAsset: createUserAssetRepository(pool),
    };

    const middleware = {
        authenticate: createAuthenticate({
            jwt,
            jwtSecret: config.jwtSecret,
            tokenBlacklistRepository: repositories.tokenBlacklist,
            logger,
        }),
        requireAdmin: createRequireAdmin({
            userRepository: repositories.user,
            logger,
        }),
    };

    const services = {
        auth: createAuthService({
            userRepository: repositories.user,
            verificationCodeRepository: repositories.verificationCode,
            tokenBlacklistRepository: repositories.tokenBlacklist,
            emailClient: o.emailClient || createEmailClient({ logger }),
            jwt,
            jwtSecret: config.jwtSecret,
            logger,
        }),
        community: createCommunityService({
            communityRepository: repositories.community,
            tokenBlacklistRepository: repositories.tokenBlacklist,
            jwt,
            jwtSecret: config.jwtSecret,
            logger,
        }),
        feedback: createFeedbackService({
            feedbackRepository: repositories.feedback,
            logger,
            jwt,
            jwtSecret: config.jwtSecret,
        }),
        userAsset: createUserAssetService({
            userAssetRepository: repositories.userAsset,
            cosConfig: config.cos,
            logger,
        }),
    };

    const controllers = {
        auth: createAuthController({ authService: services.auth }),
        community: createCommunityController({ communityService: services.community }),
        feedback: createFeedbackController({ feedbackService: services.feedback }),
        userAsset: createUserAssetController({ userAssetService: services.userAsset, logger }),
    };

    const routes = {
        auth: createAuthRoutes({ authController: controllers.auth, authenticate: middleware.authenticate }),
        community: createCommunityRoutes({
            communityController: controllers.community,
            authenticate: middleware.authenticate,
        }),
        feedback: createFeedbackRoutes({
            feedbackController: controllers.feedback,
            authenticate: middleware.authenticate,
            requireAdmin: middleware.requireAdmin,
        }),
        userAsset: createUserAssetRoutes({
            userAssetController: controllers.userAsset,
            authenticate: middleware.authenticate,
        }),
    };

    return { config, repositories, services, controllers, routes, middleware };
};
