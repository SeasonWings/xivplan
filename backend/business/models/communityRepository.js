module.exports = function createCommunityRepository(pool) {
    return {
        async createShare({
            shareId,
            title,
            description,
            author,
            authorId,
            sceneData,
            thumbnail,
            game,
            category,
            dungeonName,
            tagsJson,
        }) {
            await pool.execute(
                `INSERT INTO plan_shares 
                (share_id, title, description, author, author_id, scene_data, thumbnail, game, category, dungeon_name, tags) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    shareId,
                    title,
                    description || '',
                    author,
                    authorId,
                    sceneData,
                    thumbnail || null,
                    game,
                    category,
                    dungeonName || null,
                    tagsJson,
                ],
            );
        },

        async countShares({ whereClause, params }) {
            const [rows] = await pool.execute(`SELECT COUNT(*) as total FROM plan_shares ${whereClause}`, params);
            return rows[0]?.total ?? 0;
        },

        async listShares({ whereClause, params, sortField, sortOrder, limit, offset }) {
            const [rows] = await pool.execute(
                `SELECT 
                    ps.share_id, ps.title, ps.description, u.username as author, ps.thumbnail, ps.game, ps.category, ps.dungeon_name, 
                    ps.tags, ps.view_count, ps.download_count, ps.like_count, ps.created_at, ps.updated_at,
                    u.avatar as author_avatar
                FROM plan_shares ps
                LEFT JOIN users u ON ps.author_id = u.user_id
                ${whereClause}
                ORDER BY ${sortField} ${sortOrder}
                LIMIT ? OFFSET ?`,
                [...params, limit, offset],
            );
            return rows;
        },

        async getShareById(shareId) {
            const [rows] = await pool.execute(
                `SELECT 
                    ps.*, 
                    u.username as author,
                    u.avatar as author_avatar
                FROM plan_shares ps
                LEFT JOIN users u ON ps.author_id = u.user_id
                WHERE ps.share_id = ? AND ps.status = 1`,
                [shareId],
            );
            return rows[0] || null;
        },

        async countCommentsByShareId(shareId) {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) as total FROM plan_comments WHERE share_id = ? AND status = 1`,
                [shareId],
            );
            return rows[0]?.total ?? 0;
        },

        async incrementView(shareId) {
            await pool.execute(`UPDATE plan_shares SET view_count = view_count + 1 WHERE share_id = ?`, [shareId]);
        },

        async incrementDownload(shareId) {
            await pool.execute(`UPDATE plan_shares SET download_count = download_count + 1 WHERE share_id = ?`, [
                shareId,
            ]);
        },

        async findLike(shareId, userId) {
            const [rows] = await pool.execute(`SELECT * FROM plan_likes WHERE share_id = ? AND user_id = ?`, [
                shareId,
                userId,
            ]);
            return rows[0] || null;
        },

        async addLike(shareId, userId) {
            await pool.execute(`INSERT INTO plan_likes (share_id, user_id) VALUES (?, ?)`, [shareId, userId]);
            await pool.execute(`UPDATE plan_shares SET like_count = like_count + 1 WHERE share_id = ?`, [shareId]);
        },

        async removeLike(shareId, userId) {
            await pool.execute(`DELETE FROM plan_likes WHERE share_id = ? AND user_id = ?`, [shareId, userId]);
            await pool.execute(`UPDATE plan_shares SET like_count = like_count - 1 WHERE share_id = ?`, [shareId]);
        },

        async getCategoryStats() {
            const [rows] = await pool.execute(
                `SELECT category, COUNT(*) as count FROM plan_shares WHERE status = 1 GROUP BY category`,
            );
            return rows;
        },

        async addReport(shareId, userId, reason) {
            await pool.execute(`INSERT INTO plan_reports (share_id, user_id, reason) VALUES (?, ?, ?)`, [
                shareId,
                userId,
                reason,
            ]);
        },

        async countParentComments(shareId) {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) as total FROM plan_comments WHERE share_id = ? AND status = 1 AND parent_id IS NULL`,
                [shareId],
            );
            return rows[0]?.total ?? 0;
        },

        async listParentComments(shareId, { sortOrder, limit, offset }) {
            const [rows] = await pool.execute(
                `SELECT 
                    c.id, c.share_id, c.user_id, c.user_name, c.user_avatar, 
                    c.content, c.created_at, c.updated_at
                FROM plan_comments c
                WHERE c.share_id = ? AND c.status = 1 AND c.parent_id IS NULL
                ORDER BY c.created_at ${sortOrder}
                LIMIT ? OFFSET ?`,
                [shareId, limit, offset],
            );
            return rows;
        },

        async listLatestReply(parentId) {
            const [rows] = await pool.execute(
                `SELECT 
                    c.id, c.user_id, c.user_name, c.user_avatar, 
                    c.content, c.reply_to_user_id, c.reply_to_user_name,
                    c.created_at, c.updated_at
                FROM plan_comments c
                WHERE c.parent_id = ? AND c.status = 1
                ORDER BY c.created_at ASC
                LIMIT 1`,
                [parentId],
            );
            return rows;
        },

        async countReplies(parentId) {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) as count FROM plan_comments WHERE parent_id = ? AND status = 1`,
                [parentId],
            );
            return rows[0]?.count ?? 0;
        },

        async listReplies(parentId, { limit, offset }) {
            const [rows] = await pool.execute(
                `SELECT 
                    c.id, c.user_id, c.user_name, c.user_avatar, 
                    c.content, c.reply_to_user_id, c.reply_to_user_name,
                    c.created_at, c.updated_at
                FROM plan_comments c
                WHERE c.parent_id = ? AND c.status = 1
                ORDER BY c.created_at ASC
                LIMIT ? OFFSET ?`,
                [parentId, limit, offset],
            );
            return rows;
        },

        async getUserBasic(userId) {
            const [rows] = await pool.execute(`SELECT user_id, username, avatar FROM users WHERE user_id = ?`, [
                userId,
            ]);
            return rows[0] || null;
        },

        async shareExists(shareId) {
            const [rows] = await pool.execute(`SELECT id FROM plan_shares WHERE share_id = ? AND status = 1`, [
                shareId,
            ]);
            return rows.length > 0;
        },

        async parentCommentExists(parentId, shareId) {
            const [rows] = await pool.execute(
                `SELECT id FROM plan_comments WHERE id = ? AND share_id = ? AND status = 1`,
                [parentId, shareId],
            );
            return rows.length > 0;
        },

        async createComment({
            shareId,
            userId,
            userName,
            userAvatar,
            content,
            parentId,
            replyToUserId,
            replyToUserName,
        }) {
            const [result] = await pool.execute(
                `INSERT INTO plan_comments 
                (share_id, user_id, user_name, user_avatar, content, parent_id, reply_to_user_id, reply_to_user_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    shareId,
                    userId,
                    userName,
                    userAvatar || null,
                    content,
                    parentId || null,
                    replyToUserId || null,
                    replyToUserName || null,
                ],
            );
            return { id: result.insertId };
        },

        async incrementCommentCount(shareId) {
            await pool.execute(`UPDATE plan_shares SET comment_count = comment_count + 1 WHERE share_id = ?`, [
                shareId,
            ]);
        },

        async getCommentById(commentId) {
            const [rows] = await pool.execute(
                `SELECT 
                    id, share_id, user_id, user_name, user_avatar, 
                    content, parent_id, reply_to_user_id, reply_to_user_name,
                    created_at, updated_at, status
                FROM plan_comments WHERE id = ?`,
                [commentId],
            );
            return rows[0] || null;
        },

        async getActiveCommentForDelete(commentId, shareId) {
            const [rows] = await pool.execute(
                `SELECT id, user_id, parent_id FROM plan_comments WHERE id = ? AND share_id = ? AND status = 1`,
                [commentId, shareId],
            );
            return rows[0] || null;
        },

        async softDeleteComment(commentId) {
            await pool.execute(`UPDATE plan_comments SET status = 0 WHERE id = ?`, [commentId]);
        },

        async decrementCommentCount(shareId) {
            await pool.execute(
                `UPDATE plan_shares SET comment_count = GREATEST(comment_count - 1, 0) WHERE share_id = ?`,
                [shareId],
            );
        },
    };
};
