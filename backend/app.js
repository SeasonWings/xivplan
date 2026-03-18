// 加载环境变量
require('dotenv').config();

const http = require('http');
const { promisePool: pool } = require('./db');
const logger = require('./services/logger');
const createContainer = require('./business/di/createContainer');
const createApp = require('./business/http/createApp');
const setupMetrics = require('./business/metrics/setupMetrics');
const attachWebSocketServer = require('./business/ws/attachWebSocketServer');
const startupChecks = require('./business/startupChecks');
const startServer = require('./business/startServer');

const container = createContainer({ pool, logger, env: process.env });
const app = createApp({ baseDir: __dirname, logger, routes: container.routes });
const metrics = setupMetrics(app);

// 创建HTTP服务器
const server = http.createServer(app);

const { wss } = attachWebSocketServer(server, { logger, metrics });

// 启动服务器
const PORT = process.env.PORT || 3001;

startupChecks(logger);
startServer({ server, wss, port: PORT, logger });
