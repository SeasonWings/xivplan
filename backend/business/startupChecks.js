const { testConnection } = require('../db');
const { testEmailConnection } = require('../email');

module.exports = function startupChecks(logger) {
    testConnection().then((connected) => {
        if (!connected) {
            logger.log('warn', 'db', 'db.connection_failed', { feature: 'community' });
        }
    });

    testEmailConnection().then((connected) => {
        if (!connected) {
            logger.log('warn', 'email', 'email.connection_failed', { feature: 'email' });
        }
    });
};
