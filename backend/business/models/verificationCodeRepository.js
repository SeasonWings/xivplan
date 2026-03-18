module.exports = function createVerificationCodeRepository(pool) {
    return {
        async upsert({ email, code, type, expiresAt }) {
            await pool.execute(
                `INSERT INTO verification_codes (email, code, type, expires_at) 
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 code = VALUES(code), 
                 expires_at = VALUES(expires_at), 
                 used = 0`,
                [email, code, type, expiresAt],
            );
        },

        async findValid({ email, code, type }) {
            const [rows] = await pool.execute(
                `SELECT * FROM verification_codes 
                 WHERE email = ? AND code = ? AND type = ? 
                 AND expires_at > NOW() AND used = 0`,
                [email, code, type],
            );
            return rows[0] || null;
        },

        async markUsed(id) {
            await pool.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', [id]);
        },
    };
};
