const { transporter, emailConfig } = require('../email');

// 邮件发送服务
class EmailService {
    constructor() {
        this.transporter = transporter;
    }

    // 生成验证码 (6位数字)
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 发送验证邮件
    async sendVerificationEmail(email, code, type) {
        let subject, html;

        switch (type) {
            case 'register':
                subject = 'AstroPlan账户注册验证码';
                html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>欢迎注册AstroPlan</h2>
            <p>感谢您注册AstroPlan账户，请使用以下验证码完成验证：</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; padding: 15px 30px; font-size: 24px; background-color: #f0f0f0; border-radius: 5px; letter-spacing: 5px;">
                ${code}
              </span>
            </div>
            <p>此验证码将在30分钟内有效。</p>
            <p>如果您没有注册AstroPlan账户，请忽略此邮件。</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #666; font-size: 12px;">此邮件由AstroPlan自动发送，请勿回复。</p>
          </div>
        `;
                break;
            case 'reset_password':
                subject = 'AstroPlan密码重置验证码';
                html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>密码重置申请</h2>
            <p>您申请了AstroPlan账户密码重置，请使用以下验证码完成操作：</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; padding: 15px 30px; font-size: 24px; background-color: #f0f0f0; border-radius: 5px; letter-spacing: 5px;">
                ${code}
              </span>
            </div>
            <p>此验证码将在30分钟内有效。</p>
            <p>如果您没有申请密码重置，请忽略此邮件。</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #666; font-size: 12px;">此邮件由AstroPlan自动发送，请勿回复。</p>
          </div>
        `;
                break;
            default:
                subject = 'AstroPlan验证码';
                html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>验证码</h2>
            <p>您的验证码是：</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; padding: 15px 30px; font-size: 24px; background-color: #f0f0f0; border-radius: 5px; letter-spacing: 5px;">
                ${code}
              </span>
            </div>
            <p>此验证码将在30分钟内有效。</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #666; font-size: 12px;">此邮件由AstroPlan自动发送，请勿回复。</p>
          </div>
        `;
        }

        const mailOptions = {
            from: `"AstroPlan" <${emailConfig.auth.user}>`,
            to: email,
            subject: subject,
            html: html,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Verification email sent: ' + info.response);
            return true;
        } catch (error) {
            console.error('Error sending verification email:', error);
            return false;
        }
    }
}

module.exports = EmailService;
