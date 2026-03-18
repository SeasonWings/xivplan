module.exports = function createTokenBlacklistRepository(pool) {
    return {
        async isBlacklisted(token) {
            const [rows] = await pool.execute('SELECT token FROM blacklisted_tokens WHERE token = ?', [token]);
            return rows.length > 0;
        },

        async add(token, expiresAtUnixSeconds) {
            await pool.execute(
                `INSERT INTO blacklisted_tokens (token, expires_at) VALUES (?, FROM_UNIXTIME(?))
                 ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
                [token, expiresAtUnixSeconds],
            );
        },
    };
};
