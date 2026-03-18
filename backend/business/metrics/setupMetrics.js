const promClient = require('prom-client');

module.exports = function setupMetrics(app) {
    promClient.collectDefaultMetrics({ prefix: 'xivplan_' });

    const cursorSyncDelaySeconds = new promClient.Histogram({
        name: 'cursor_sync_delay_seconds',
        help: 'Cursor relay delay in seconds (server receive -> server broadcast)',
        labelNames: ['room_id'],
        buckets: [0.005, 0.01, 0.02, 0.05, 0.08, 0.12, 0.2, 0.5, 1],
    });

    const cursorLostPacketsTotal = new promClient.Counter({
        name: 'cursor_lost_packets_total',
        help: 'Estimated lost cursor packets (sequence gaps) observed by server',
        labelNames: ['room_id'],
    });

    app.get('/metrics', async (_req, res) => {
        res.setHeader('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
    });

    return { promClient, cursorSyncDelaySeconds, cursorLostPacketsTotal };
};
