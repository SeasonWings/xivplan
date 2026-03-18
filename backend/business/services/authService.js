const bcrypt = require('bcrypt');
const crypto = require('crypto');
const AppError = require('../errors/AppError');

module.exports = function createAuthService({
    userRepository,
    verificationCodeRepository,
    tokenBlacklistRepository,
    emailClient,
    jwt,
    jwtSecret,
    logger,
}) {
    const tokenExpiresIn = '7d';

    function signToken(user) {
        return jwt.sign(
            {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            jwtSecret,
            { expiresIn: tokenExpiresIn },
        );
    }

    async function verifyCodeOrThrow({ email, code, type }) {
        const record = await verificationCodeRepository.findValid({ email, code, type });
        if (!record) {
            throw new AppError('验证码无效或已过期', { status: 400, code: 'INVALID_CODE' });
        }
        await verificationCodeRepository.markUsed(record.id);
    }

    return {
        async requestRegisterCode(email) {
            if (!email) throw new AppError('邮箱不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            const existing = await userRepository.findByEmail(email);
            if (existing) {
                throw new AppError('该邮箱已被注册', { status: 400, code: 'EMAIL_TAKEN' });
            }

            const code = emailClient.generateVerificationCode();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
            await verificationCodeRepository.upsert({ email, code, type: 'register', expiresAt });

            const ok = await emailClient.sendVerificationEmail(email, code, 'register');
            if (!ok) {
                throw new AppError('验证码发送失败，请稍后再试', { status: 500, code: 'EMAIL_SEND_FAILED' });
            }

            return { expiresIn: 30 * 60 };
        },

        async verifyRegisterCode(email, code) {
            if (!email || !code) throw new AppError('邮箱和验证码不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            await verifyCodeOrThrow({ email, code, type: 'register' });
            return true;
        },

        async register({ username, email, password, verificationCode }) {
            if (!username || !email || !password || !verificationCode) {
                throw new AppError('所有字段都是必填的', { status: 400, code: 'VALIDATION_ERROR' });
            }

            const existing = await userRepository.existsByUsernameOrEmail(username, email);
            if (existing) {
                throw new AppError('用户名或邮箱已被使用', { status: 400, code: 'DUPLICATE_USER' });
            }

            await verifyCodeOrThrow({ email, code: verificationCode, type: 'register' });

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            const userId = crypto.randomUUID();

            await userRepository.create({ userId, username, email, passwordHash });

            const user = await userRepository.findById(userId);
            const token = signToken(user);

            return { token, user };
        },

        async login({ usernameOrEmail, password }) {
            if (!usernameOrEmail || !password) {
                throw new AppError('用户名/邮箱和密码不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            }

            const byEmail = usernameOrEmail.includes('@');
            const user = byEmail
                ? await userRepository.findByEmail(usernameOrEmail)
                : await userRepository.findByUsername(usernameOrEmail);

            if (!user) {
                throw new AppError('用户名/邮箱或密码错误', { status: 400, code: 'INVALID_CREDENTIALS' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                throw new AppError('用户名/邮箱或密码错误', { status: 400, code: 'INVALID_CREDENTIALS' });
            }

            const token = signToken(user);
            await userRepository.updateLastLogin(user.user_id);

            return { token, user };
        },

        async logout(authHeader) {
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AppError('缺少认证信息', { status: 401, code: 'UNAUTHORIZED' });
            }
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, jwtSecret);
            await tokenBlacklistRepository.add(token, decoded.exp);
        },

        async me(userId) {
            const user = await userRepository.findPublicById(userId);
            if (!user) throw new AppError('用户不存在', { status: 404, code: 'NOT_FOUND' });
            return user;
        },

        async updateProfile(userId, { username, avatar, bio }) {
            const { affectedRows } = await userRepository.updateProfile(userId, { username, avatar, bio });
            if (!affectedRows) {
                throw new AppError('用户不存在或更新失败', { status: 400, code: 'UPDATE_FAILED' });
            }
            const user = await userRepository.findPublicById(userId);
            return user;
        },

        async changePassword(userId, { currentPassword, newPassword }) {
            if (!currentPassword || !newPassword) {
                throw new AppError('当前密码和新密码不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            }
            const user = await userRepository.findById(userId);
            if (!user) throw new AppError('用户不存在', { status: 404, code: 'NOT_FOUND' });

            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) throw new AppError('当前密码错误', { status: 400, code: 'INVALID_PASSWORD' });

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(newPassword, salt);
            await userRepository.updatePasswordByUserId(userId, passwordHash);
        },

        async requestResetPasswordCode(email) {
            if (!email) throw new AppError('邮箱不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            const user = await userRepository.findByEmail(email);
            if (!user) throw new AppError('该邮箱未注册', { status: 400, code: 'EMAIL_NOT_REGISTERED' });

            const code = emailClient.generateVerificationCode();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
            await verificationCodeRepository.upsert({ email, code, type: 'reset_password', expiresAt });

            const ok = await emailClient.sendVerificationEmail(email, code, 'reset_password');
            if (!ok) throw new AppError('验证码发送失败，请稍后再试', { status: 500, code: 'EMAIL_SEND_FAILED' });

            return { expiresIn: 30 * 60 };
        },

        async verifyResetPasswordCode(email, code) {
            if (!email || !code) throw new AppError('邮箱和验证码不能为空', { status: 400, code: 'VALIDATION_ERROR' });
            await verifyCodeOrThrow({ email, code, type: 'reset_password' });
            return true;
        },

        async resetPassword({ email, verificationCode, newPassword }) {
            if (!email || !verificationCode || !newPassword) {
                throw new AppError('所有字段都是必填的', { status: 400, code: 'VALIDATION_ERROR' });
            }
            await verifyCodeOrThrow({ email, code: verificationCode, type: 'reset_password' });

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(newPassword, salt);
            await userRepository.updatePasswordByEmail(email, passwordHash);
        },
    };
};
