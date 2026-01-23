const mysql = require('mysql2');

// 从环境变量获取数据库配置，如果不存在则使用默认值
const dbConfig = {
    host: process.env.DB_HOST || '',
    user: process.env.DB_USER || 'xivplan',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'xivplan',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 创建支持Promise的连接池
const promisePool = pool.promise();

// 获取数据库连接的便捷方法
const getConnection = () => {
    return pool.promise().getConnection();
};

// 测试数据库连接的函数
const testConnection = async () => {
    try {
        const connection = await getConnection();
        console.log('✅ Database connected successfully');
        connection.release(); // 释放连接回连接池
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

module.exports = {
    pool,
    promisePool,
    getConnection,
    testConnection,
};
