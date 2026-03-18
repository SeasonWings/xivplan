const json = require('../views/json');
const { toUserVO } = require('../views/userView');

module.exports = function createAuthController({ authService }) {
    return {
        requestRegisterCode: async (req, res, next) => {
            try {
                const result = await authService.requestRegisterCode(req.body?.email);
                return json.ok(res, result, { message: '验证码已发送' });
            } catch (e) {
                return next(e);
            }
        },

        verifyRegisterCode: async (req, res, next) => {
            try {
                await authService.verifyRegisterCode(req.body?.email, req.body?.code);
                return json.message(res, '验证码验证成功');
            } catch (e) {
                return next(e);
            }
        },

        register: async (req, res, next) => {
            try {
                const { token, user } = await authService.register({
                    username: req.body?.username,
                    email: req.body?.email,
                    password: req.body?.password,
                    verificationCode: req.body?.verificationCode,
                });
                return res.status(201).json({ success: true, token, user: toUserVO(user) });
            } catch (e) {
                return next(e);
            }
        },

        login: async (req, res, next) => {
            try {
                const { token, user } = await authService.login({
                    usernameOrEmail:
                        req.body?.usernameOrEmail ?? req.body?.identifier ?? req.body?.username ?? req.body?.email,
                    password: req.body?.password,
                });
                return res.json({ success: true, token, user: toUserVO(user) });
            } catch (e) {
                return next(e);
            }
        },

        logout: async (req, res, next) => {
            try {
                await authService.logout(req.headers?.authorization);
                return json.message(res, '登出成功');
            } catch (e) {
                return next(e);
            }
        },

        me: async (req, res, next) => {
            try {
                const user = await authService.me(req.user.userId);
                return res.json({ success: true, user: toUserVO(user) });
            } catch (e) {
                return next(e);
            }
        },

        updateProfile: async (req, res, next) => {
            try {
                const user = await authService.updateProfile(req.user.userId, {
                    username: req.body?.username,
                    avatar: req.body?.avatar,
                    bio: req.body?.bio,
                });
                return res.json({ success: true, user: toUserVO(user), message: '个人资料更新成功' });
            } catch (e) {
                return next(e);
            }
        },

        changePassword: async (req, res, next) => {
            try {
                await authService.changePassword(req.user.userId, {
                    currentPassword: req.body?.currentPassword,
                    newPassword: req.body?.newPassword,
                });
                return json.message(res, '密码修改成功');
            } catch (e) {
                return next(e);
            }
        },

        requestResetPasswordCode: async (req, res, next) => {
            try {
                const result = await authService.requestResetPasswordCode(req.body?.email);
                return json.ok(res, result, { message: '验证码已发送' });
            } catch (e) {
                return next(e);
            }
        },

        verifyResetPasswordCode: async (req, res, next) => {
            try {
                await authService.verifyResetPasswordCode(req.body?.email, req.body?.code);
                return json.message(res, '验证码验证成功');
            } catch (e) {
                return next(e);
            }
        },

        resetPassword: async (req, res, next) => {
            try {
                await authService.resetPassword({
                    email: req.body?.email,
                    verificationCode: req.body?.verificationCode,
                    newPassword: req.body?.newPassword,
                });
                return json.message(res, '密码重置成功');
            } catch (e) {
                return next(e);
            }
        },
    };
};
