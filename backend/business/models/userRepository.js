module.exports = function createUserRepository(pool) {
    return {
        async findByEmail(email) {
            const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
            return rows[0] || null;
        },

        async findByUsername(username) {
            const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
            return rows[0] || null;
        },

        async findById(userId) {
            const [rows] = await pool.execute(
                'SELECT user_id, username, email, avatar, bio, role, is_verified, email_verified, created_at, updated_at, password_hash FROM users WHERE user_id = ?',
                [userId],
            );
            return rows[0] || null;
        },

        async findPublicById(userId) {
            const [rows] = await pool.execute(
                'SELECT user_id, username, email, avatar, bio, role, is_verified, email_verified, created_at, updated_at FROM users WHERE user_id = ?',
                [userId],
            );
            return rows[0] || null;
        },

        async existsByUsernameOrEmail(username, email) {
            const [rows] = await pool.execute('SELECT user_id FROM users WHERE username = ? OR email = ?', [
                username,
                email,
            ]);
            return rows.length > 0;
        },

        async create({ userId, username, email, passwordHash }) {
            await pool.execute(
                `INSERT INTO users (user_id, username, email, password_hash, email_verified) 
                 VALUES (?, ?, ?, ?, TRUE)`,
                [userId, username, email, passwordHash],
            );
        },

        async updateLastLogin(userId) {
            await pool.execute('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [userId]);
        },

        async updateProfile(userId, { username, avatar, bio }) {
            let updateQuery = 'UPDATE users SET updated_at = NOW()';
            const params = [];

            if (username) {
                updateQuery += ', username = ?';
                params.push(username);
            }
            if (avatar !== undefined) {
                updateQuery += ', avatar = ?';
                params.push(avatar);
            }
            if (bio !== undefined) {
                updateQuery += ', bio = ?';
                params.push(bio);
            }

            updateQuery += ' WHERE user_id = ?';
            params.push(userId);

            const [result] = await pool.execute(updateQuery, params);
            return { affectedRows: result.affectedRows };
        },

        async updatePasswordByUserId(userId, passwordHash) {
            await pool.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?', [
                passwordHash,
                userId,
            ]);
        },

        async updatePasswordByEmail(email, passwordHash) {
            await pool.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE email = ?', [
                passwordHash,
                email,
            ]);
        },
    };
};
