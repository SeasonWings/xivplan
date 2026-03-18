const express = require('express');

const setupHttpApp = require('./setupHttpApp');

module.exports = function createApp({ baseDir, logger, routes }) {
    const app = express();
    setupHttpApp(app, { baseDir, logger, routes });
    return app;
};
