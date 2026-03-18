const express = require('express');

module.exports = function createAuthRoutes({ authController, authenticate }) {
    const router = express.Router();

    router.post('/request-register-code', authController.requestRegisterCode);
    router.post('/verify-register-code', authController.verifyRegisterCode);
    router.post('/register', authController.register);
    router.post('/login', authController.login);
    router.post('/logout', authenticate, authController.logout);
    router.get('/me', authenticate, authController.me);
    router.put('/profile', authenticate, authController.updateProfile);
    router.put('/change-password', authenticate, authController.changePassword);
    router.post('/request-reset-password-code', authController.requestResetPasswordCode);
    router.post('/verify-reset-password-code', authController.verifyResetPasswordCode);
    router.post('/reset-password', authController.resetPassword);

    return router;
};
