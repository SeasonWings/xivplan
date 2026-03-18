module.exports = function startServer({ server, wss, port, logger }) {
    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            logger.log('error', 'server', 'server.listen_failed', { port: port, code: err.code, message: err.message });
        } else {
            logger.log('error', 'server', 'server.error', {
                port: port,
                error: { name: err.name, message: err.message, stack: err.stack },
            });
        }
        process.exit(1);
    });

    if (wss) {
        wss.on('error', (err) => {
            logger.log('error', 'ws', 'ws.server.error', {
                error: { name: err.name, message: err.message, stack: err.stack },
            });
        });
    }

    server.listen(port, () => {
        logger.log('info', 'server', 'server.listen', { port: port });
        logger.log('info', 'server', 'server.endpoints', {
            websocket: `ws://localhost:${port}`,
            api: `http://localhost:${port}/api`,
            metrics: `http://localhost:${port}/metrics`,
        });
    });
};
