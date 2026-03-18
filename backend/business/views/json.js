module.exports = {
    ok(res, data, extra) {
        return res.json({ success: true, ...(extra || {}), data });
    },
    created(res, data, extra) {
        return res.status(201).json({ success: true, ...(extra || {}), data });
    },
    message(res, message, extra) {
        return res.json({ success: true, message, ...(extra || {}) });
    },
};
