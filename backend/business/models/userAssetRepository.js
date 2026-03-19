module.exports = function createUserAssetRepository(pool) {
    return {
        async addAsset(userId, assetUrl, fileName, fileSize) {
            const [result] = await pool.execute(
                'INSERT INTO user_assets (user_id, asset_url, file_name, file_size) VALUES (?, ?, ?, ?)',
                [userId, assetUrl, fileName, fileSize],
            );
            return result.insertId;
        },

        async getAssetsByUserId(userId) {
            const [rows] = await pool.execute('SELECT * FROM user_assets WHERE user_id = ? ORDER BY created_at DESC', [
                userId,
            ]);
            return rows;
        },

        async getAssetCountByUserId(userId) {
            const [rows] = await pool.execute('SELECT COUNT(*) as count FROM user_assets WHERE user_id = ?', [userId]);
            return rows[0].count;
        },

        async deleteAsset(userId, assetId) {
            const [result] = await pool.execute('DELETE FROM user_assets WHERE id = ? AND user_id = ?', [
                assetId,
                userId,
            ]);
            return result.affectedRows > 0;
        },

        async getAssetById(assetId) {
            const [rows] = await pool.execute('SELECT * FROM user_assets WHERE id = ?', [assetId]);
            return rows[0];
        },
    };
};
