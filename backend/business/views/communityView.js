module.exports = {
    toPlanListItem(row) {
        return {
            share_id: row.share_id,
            title: row.title,
            description: row.description,
            author: row.author,
            thumbnail: row.thumbnail,
            game: row.game,
            category: row.category,
            dungeon_name: row.dungeon_name,
            tags: row.tags ? JSON.parse(row.tags) : [],
            view_count: row.view_count,
            download_count: row.download_count,
            like_count: row.like_count,
            created_at: row.created_at,
            updated_at: row.updated_at,
            author_avatar: row.author_avatar ?? null,
        };
    },

    toPlanDetail(row, commentCount) {
        return {
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            comment_count: commentCount,
        };
    },
};
