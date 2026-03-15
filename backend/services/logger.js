const { promisePool: pool } = require('../db');
const crypto = require('crypto');

/**
 * API日志服务
 * 用于记录所有API接口的执行状态、入参和出参
 */
class Logger {
    /**
     * 生成唯一请求ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    log(level, scope, event, data = {}) {
        if (level === 'debug' && process.env.NODE_ENV !== 'development') {
            return;
        }

        const pad2 = (n) => String(n).padStart(2, '0');
        const d = new Date();
        const ts = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
            d.getMinutes(),
        )}:${pad2(d.getSeconds())}`;

        const titleCase = (s) => {
            if (!s) return s;
            return `${s[0].toUpperCase()}${s.slice(1)}`;
        };

        const scopeMap = {
            app: 'Backend',
            http: 'API',
            server: 'Server',
            db: 'DB',
            email: 'Email',
            logger: 'Logger',
            metrics: 'Metrics',
            health: 'Health',
            auth: 'Auth',
            community: 'Community',
            feedback: 'Feedback',
        };

        const resolveComponent = (rawScope) => {
            if (!rawScope) return 'Backend';
            if (scopeMap[rawScope]) return scopeMap[rawScope];
            if (rawScope.includes('.')) {
                const parts = rawScope.split('.');
                if (parts[0] === 'api' && parts[1]) {
                    return scopeMap[parts[1]] || titleCase(parts[1]);
                }
                if (parts[0] === 'ws') {
                    const rest = parts
                        .slice(1)
                        .filter(Boolean)
                        .map((p) => scopeMap[p] || titleCase(p));
                    return rest.length > 0 ? `WS.${rest.join('.')}` : 'WS';
                }
                return parts
                    .filter(Boolean)
                    .map((p) => scopeMap[p] || titleCase(p))
                    .join('.');
            }
            return titleCase(rawScope);
        };

        const component = resolveComponent(scope);
        const levelUpper = String(level || 'info').toUpperCase();
        const extra =
            data && typeof data === 'object' && Object.keys(data).length > 0 ? ` - ${JSON.stringify(data)}` : '';

        process.stdout.write(`[${ts}] ${component} | ${levelUpper} | ${event}${extra}\n`);
    }

    /**
     * 记录API日志到数据库
     * @param {Object} logData - 日志数据
     */
    async logToDatabase(logData) {
        try {
            const {
                requestId,
                userId = null,
                method,
                url,
                route,
                ipAddress = null,
                userAgent = null,
                requestHeaders = null,
                requestParams = null,
                requestBody = null,
                responseStatus,
                responseBody = null,
                errorMessage = null,
                errorStack = null,
                executionTime,
                success = true,
                level = 'info',
            } = logData;

            await pool.execute(
                `INSERT INTO api_logs 
                (request_id, user_id, method, url, route, ip_address, user_agent, 
                 request_headers, request_params, request_body, response_status, 
                 response_body, error_message, error_stack, execution_time, success, level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    requestId,
                    userId,
                    method,
                    url,
                    route,
                    ipAddress,
                    userAgent,
                    requestHeaders ? JSON.stringify(requestHeaders) : null,
                    requestParams ? JSON.stringify(requestParams) : null,
                    requestBody ? JSON.stringify(requestBody) : null,
                    responseStatus,
                    responseBody ? JSON.stringify(responseBody) : null,
                    errorMessage,
                    errorStack,
                    executionTime,
                    success,
                    level,
                ],
            );
        } catch (error) {
            // 日志记录失败不应影响主业务流程，仅打印到控制台
            this.log('error', 'logger', 'logger.db_write_failed', {
                error: { name: error.name, message: error.message, stack: error.stack },
            });
        }
    }

    /**
     * 记录信息级别日志
     */
    info(message, data = {}) {
        this.log('info', 'app', message, data);
    }

    /**
     * 记录警告级别日志
     */
    warn(message, data = {}) {
        this.log('warn', 'app', message, data);
    }

    /**
     * 记录错误级别日志
     */
    error(message, error = null, data = {}) {
        this.log('error', 'app', message, {
            ...data,
            error: error
                ? {
                      name: error.name,
                      message: error.message,
                      stack: error.stack,
                  }
                : undefined,
        });
    }

    /**
     * 记录调试级别日志
     */
    debug(message, data = {}) {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', 'app', message, data);
        }
    }

    /**
     * 创建API日志中间件
     * - 所有请求都打印到控制台，包含入参、出参、调用者信息，便于实时监控
     * - 只有失败的请求（状态码 >= 400）才持久化到数据库，减少存储压力
     */
    createMiddleware() {
        return async (req, res, next) => {
            const startTime = Date.now();
            const requestId = this.generateRequestId();

            // 将requestId附加到请求对象，供后续使用
            req.requestId = requestId;
            res.setHeader('x-request-id', requestId);

            // 获取用户ID（如果已认证）
            let userId = null;
            if (req.user && req.user.userId) {
                userId = req.user.userId;
            }

            // 获取客户端IP
            const ipAddress = req.ip || req.connection.remoteAddress;

            // 保存原始的res.json和res.status方法
            const originalJson = res.json.bind(res);
            const originalStatus = res.status.bind(res);

            let responseBody = null;
            let responseStatus = 200;
            let wroteJson = false;

            // 重写res.status方法
            res.status = function (statusCode) {
                responseStatus = statusCode;
                return originalStatus(statusCode);
            };

            // 重写res.json方法以捕获响应体
            res.json = function (body) {
                wroteJson = true;
                responseBody = body;
                return originalJson(body);
            }.bind(this);

            res.on('finish', () => {
                const executionTime = Date.now() - startTime;
                const success = responseStatus >= 200 && responseStatus < 400;
                const level = success ? 'info' : responseStatus >= 500 ? 'error' : 'warn';

                const requestBody =
                    req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
                        ? this.sanitizeRequestBody(req.body)
                        : undefined;
                const requestParams = req.query && Object.keys(req.query).length > 0 ? req.query : undefined;
                const sanitizedResponse = wroteJson ? this.sanitizeResponseBody(responseBody) : undefined;

                const originalUrl = req.originalUrl || req.url;
                const baseUrl = req.baseUrl || '';
                const routeScope =
                    baseUrl === '/api/community'
                        ? 'api.community'
                        : baseUrl === '/api/auth'
                          ? 'api.auth'
                          : baseUrl === '/api/feedback'
                            ? 'api.feedback'
                            : originalUrl?.startsWith?.('/metrics')
                              ? 'metrics'
                              : originalUrl?.startsWith?.('/api/health')
                                ? 'health'
                                : 'http';

                this.log(level, routeScope, 'http.request', {
                    requestId,
                    method: req.method,
                    url: originalUrl,
                    route: req.route ? req.route.path : req.path,
                    ip: ipAddress,
                    userId: userId ?? undefined,
                    userAgent: req.get('user-agent'),
                    status: responseStatus,
                    durationMs: executionTime,
                    query: requestParams,
                    body: requestBody,
                    response: !success ? sanitizedResponse : undefined,
                });

                if (!success) {
                    logger
                        .logToDatabase({
                            requestId,
                            userId,
                            method: req.method,
                            url: req.originalUrl || req.url,
                            route: req.route ? req.route.path : req.path,
                            ipAddress,
                            userAgent: req.get('user-agent'),
                            requestHeaders: {
                                'content-type': req.get('content-type'),
                                authorization: req.get('authorization') ? 'Bearer ***' : null,
                            },
                            requestParams: requestParams,
                            requestBody: requestBody,
                            responseStatus,
                            responseBody: sanitizedResponse,
                            errorMessage: sanitizedResponse ? sanitizedResponse.error : null,
                            executionTime,
                            success,
                            level,
                        })
                        .catch((err) => {
                            this.log('error', 'logger', 'logger.db_write_failed', {
                                requestId,
                                error: { name: err.name, message: err.message, stack: err.stack },
                            });
                        });
                }
            });

            next();
        };
    }

    ws(level, event, data = {}) {
        if (typeof event === 'string' && event.startsWith('ws.')) {
            const parts = event.split('.');
            const scope = parts.length >= 2 ? `ws.${parts[1]}` : 'ws';
            this.log(level, scope, event, data);
            return;
        }
        this.log(level, 'ws', event, data);
    }

    /**
     * 清理请求体中的敏感信息
     */
    sanitizeRequestBody(body) {
        if (!body || typeof body !== 'object') return body;

        const sanitized = { ...body };
        const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'newPassword', 'currentPassword'];

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '***';
            }
        }

        return sanitized;
    }

    /**
     * 清理响应体中的敏感信息
     */
    sanitizeResponseBody(body) {
        if (!body || typeof body !== 'object') return body;

        const sanitized = { ...body };
        const sensitiveFields = ['password', 'passwordHash', 'token'];

        // 如果响应中有token，保留但标记
        if (sanitized.token) {
            sanitized.token = '***';
        }

        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '***';
            }
        }

        return sanitized;
    }

    /**
     * 清理过期日志（可选功能，定期清理超过N天的日志）
     * @param {number} days - 保留天数
     */
    async cleanupOldLogs(days = 30) {
        try {
            const result = await pool.execute(
                `DELETE FROM api_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [days],
            );

            this.log('info', 'logger', 'logger.cleanup', { affectedRows: result[0].affectedRows, days });
            return result[0].affectedRows;
        } catch (error) {
            this.log('error', 'logger', 'logger.cleanup_failed', {
                days,
                error: { name: error.name, message: error.message, stack: error.stack },
            });
            return 0;
        }
    }

    /**
     * 获取日志统计信息
     * @param {Object} options - 查询选项
     */
    async getLogStats(options = {}) {
        try {
            const { days = 7, userId = null } = options;

            let whereClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
            const params = [days];

            if (userId) {
                whereClause += ' AND user_id = ?';
                params.push(userId);
            }

            const [stats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_requests,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
                    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_requests,
                    AVG(execution_time) as avg_execution_time,
                    MAX(execution_time) as max_execution_time,
                    MIN(execution_time) as min_execution_time
                FROM api_logs ${whereClause}`,
                params,
            );

            return stats[0];
        } catch (error) {
            this.log('error', 'logger', 'logger.stats_failed', {
                options,
                error: { name: error.name, message: error.message, stack: error.stack },
            });
            return null;
        }
    }
}

// 创建单例实例
const logger = new Logger();

module.exports = logger;
