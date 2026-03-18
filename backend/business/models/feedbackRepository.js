module.exports = function createFeedbackRepository(pool) {
    return {
        async create({ userId, username, content, contactInfo, type }) {
            const [result] = await pool.execute(
                `INSERT INTO feedback (user_id, username, content, contact_info, type) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, username, content, contactInfo || null, type],
            );
            return { id: result.insertId };
        },

        async list({ page, limit, status }) {
            const offset = (page - 1) * limit;

            let query = 'SELECT * FROM feedback';
            let countQuery = 'SELECT COUNT(*) as total FROM feedback';
            const params = [];

            if (status) {
                query += ' WHERE status = ?';
                countQuery += ' WHERE status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            const listParams = [...params, limit, offset];

            const [rows] = await pool.execute(query, listParams);
            const [countResult] = await pool.execute(countQuery, params);
            const total = countResult[0]?.total ?? 0;

            return { rows, total };
        },

        async updateById(id, { status, adminReply }) {
            let query = 'UPDATE feedback SET updated_at = NOW()';
            const params = [];

            if (status) {
                query += ', status = ?';
                params.push(status);
            }

            if (adminReply !== undefined) {
                query += ', admin_reply = ?';
                params.push(adminReply);
            }

            query += ' WHERE id = ?';
            params.push(id);

            const [result] = await pool.execute(query, params);
            return { affectedRows: result.affectedRows };
        },
    };
};
