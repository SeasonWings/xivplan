const nodemailer = require('nodemailer');

// 从环境变量获取邮件配置，如果不存在则使用默认值
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 465,
    secure: process.env.EMAIL_SECURE !== '', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
    },
};

// 创建邮件传输器
const transporter = nodemailer.createTransport(emailConfig);

// 测试邮件连接的函数
const testEmailConnection = async () => {
    try {
        await transporter.verify();
        console.log('✅ Email service connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Email service connection failed:', error.message);
        return false;
    }
};

module.exports = {
    transporter,
    emailConfig,
    testEmailConnection,
};
