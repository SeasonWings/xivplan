const createCommunityRepository = require('../../business/models/communityRepository');

function createPoolMock() {
    return {
        execute: jest.fn(),
    };
}

describe('communityRepository', () => {
    test('createShare inserts plan_shares', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createCommunityRepository(pool);

        await repo.createShare({
            shareId: 's',
            title: 't',
            description: 'd',
            author: 'a',
            authorId: 'u',
            sceneData: '{}',
            thumbnail: null,
            game: 'ff14',
            category: 'c',
            dungeonName: null,
            tagsJson: null,
        });

        expect(pool.execute.mock.calls[0][0]).toMatch(/INSERT INTO plan_shares/i);
    });

    test('countShares queries total', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ total: 7 }]]);
        const repo = createCommunityRepository(pool);

        const total = await repo.countShares({ whereClause: 'WHERE status = 1', params: [] });

        expect(total).toBe(7);
    });

    test('listShares queries list with join', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ share_id: 's' }]]);
        const repo = createCommunityRepository(pool);

        const rows = await repo.listShares({
            whereClause: 'WHERE status = 1',
            params: [],
            sortField: 'created_at',
            sortOrder: 'DESC',
            limit: 10,
            offset: 0,
        });

        expect(pool.execute.mock.calls[0][0]).toMatch(/LEFT JOIN users/i);
        expect(rows).toEqual([{ share_id: 's' }]);
    });

    test('getShareById returns row', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ share_id: 's' }]]);
        const repo = createCommunityRepository(pool);

        const row = await repo.getShareById('s');

        expect(pool.execute.mock.calls[0][0]).toMatch(/WHERE ps\.share_id = \?/i);
        expect(row).toEqual({ share_id: 's' });
    });

    test('like operations call expected queries', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createCommunityRepository(pool);

        const like = await repo.findLike('s', 'u');
        expect(like).toEqual({ id: 1 });

        await repo.addLike('s', 'u');
        await repo.removeLike('s', 'u');

        expect(pool.execute.mock.calls.some((c) => /INSERT INTO plan_likes/i.test(c[0]))).toBe(true);
        expect(pool.execute.mock.calls.some((c) => /DELETE FROM plan_likes/i.test(c[0]))).toBe(true);
        expect(pool.execute.mock.calls.some((c) => /UPDATE plan_shares SET like_count/i.test(c[0]))).toBe(true);
    });

    test('comments queries compose', async () => {
        const pool = createPoolMock();
        pool.execute
            .mockResolvedValueOnce([[{ total: 2 }]])
            .mockResolvedValueOnce([[{ id: 1 }]])
            .mockResolvedValueOnce([[{ id: 3 }]])
            .mockResolvedValueOnce([[{ count: 1 }]])
            .mockResolvedValueOnce([[{ count: 1 }]])
            .mockResolvedValueOnce([[{ id: 4 }]]);
        const repo = createCommunityRepository(pool);

        const totalParents = await repo.countParentComments('s');
        expect(totalParents).toBe(2);

        const parents = await repo.listParentComments('s', { sortOrder: 'DESC', limit: 10, offset: 0 });
        expect(parents).toEqual([{ id: 1 }]);

        const latest = await repo.listLatestReply(1);
        expect(latest).toEqual([{ id: 3 }]);

        const replyCount = await repo.countReplies(1);
        expect(replyCount).toBe(1);

        const totalReplies = await repo.countReplies(9);
        expect(totalReplies).toBe(1);

        const replies = await repo.listReplies(9, { limit: 10, offset: 0 });
        expect(replies).toEqual([{ id: 4 }]);
    });

    test('misc helpers call expected SQL', async () => {
        const pool = createPoolMock();
        pool.execute
            .mockResolvedValueOnce([[{ category: 'c', count: 1 }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ user_id: 'u', username: 'n', avatar: null }]])
            .mockResolvedValueOnce([[{ id: 1 }]])
            .mockResolvedValueOnce([[{ id: 1 }]])
            .mockResolvedValueOnce([{ insertId: 10 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ id: 10 }]])
            .mockResolvedValueOnce([[{ id: 2, user_id: 'u', parent_id: null }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createCommunityRepository(pool);

        const stats = await repo.getCategoryStats();
        expect(stats).toEqual([{ category: 'c', count: 1 }]);

        await repo.addReport('s', 'u', 'r');
        await repo.incrementView('s');
        await repo.incrementDownload('s');

        const user = await repo.getUserBasic('u');
        expect(user.user_id).toBe('u');

        const exists = await repo.shareExists('s');
        expect(exists).toBe(true);

        const parentExists = await repo.parentCommentExists(1, 's');
        expect(parentExists).toBe(true);

        const created = await repo.createComment({
            shareId: 's',
            userId: 'u',
            userName: 'n',
            userAvatar: null,
            content: 'c',
            parentId: null,
            replyToUserId: null,
            replyToUserName: null,
        });
        expect(created).toEqual({ id: 10 });

        await repo.incrementCommentCount('s');

        const comment = await repo.getCommentById(10);
        expect(comment).toEqual({ id: 10 });

        const del = await repo.getActiveCommentForDelete(2, 's');
        expect(del.user_id).toBe('u');

        await repo.softDeleteComment(2);
        await repo.decrementCommentCount('s');
    });
});
