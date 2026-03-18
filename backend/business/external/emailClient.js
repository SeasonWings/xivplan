const EmailService = require('../../services/emailService');

module.exports = function createEmailClient({ logger }) {
    const service = new EmailService();

    return {
        generateVerificationCode() {
            return service.generateVerificationCode();
        },

        async sendVerificationEmail(email, code, type) {
            const ok = await service.sendVerificationEmail(email, code, type);
            logger.log(ok ? 'info' : 'warn', 'email', 'email.send_verification', {
                type,
                ok,
            });
            return ok;
        },
    };
};
