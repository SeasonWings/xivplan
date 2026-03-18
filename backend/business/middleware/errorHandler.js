const AppError = require('../errors/AppError');

module.exports = function createErrorHandler(logger) {
    return (err, req, res, _next) => {
        const appErr = err instanceof AppError ? err : new AppError('Internal Server Error');
        const status = appErr.status || 500;

        logger.log('error', 'http', 'http.error', {
            method: req.method,
            url: req.originalUrl,
            status,
            code: appErr.code,
            message: appErr.message,
            details: appErr.details,
            error: err
                ? {
                      name: err.name,
                      message: err.message,
                      stack: err.stack,
                  }
                : undefined,
        });

        res.status(status).json({
            success: false,
            error: appErr.message,
            code: appErr.code,
            details: appErr.details,
        });
    };
};
