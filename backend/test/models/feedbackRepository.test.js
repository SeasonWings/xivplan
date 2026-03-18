const createFeedbackRepository = require('../../business/models/feedbackRepository');

function createPoolMock() {
    return {
        execute: jest.fn(),
    };
}

describe('feedbackRepository', () => {
    test('create inserts feedback and returns insertId', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ insertId: 123 }]);
        const repo = createFeedbackRepository(pool);

        const result = await repo.create({
            userId: 'u1',
            username: 'alice',
            content: 'hello',
            contactInfo: 'x',
            type: 'bug',
        });

        expect(pool.execute).toHaveBeenCalledTimes(1);
        expect(pool.execute.mock.calls[0][0]).toMatch(/INSERT INTO feedback/i);
        expect(pool.execute.mock.calls[0][1]).toEqual(['u1', 'alice', 'hello', 'x', 'bug']);
        expect(result).toEqual({ id: 123 });
    });

    test('list without status queries list and total', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 5 }]]);
        const repo = createFeedbackRepository(pool);

        const result = await repo.list({ page: 2, limit: 2, status: undefined });

        expect(pool.execute).toHaveBeenCalledTimes(2);
        expect(pool.execute.mock.calls[0][0]).toMatch(/SELECT \* FROM feedback/i);
        expect(pool.execute.mock.calls[0][1]).toEqual([2, 2]);
        expect(pool.execute.mock.calls[1][0]).toMatch(/SELECT COUNT\(\*\) as total FROM feedback/i);
        expect(pool.execute.mock.calls[1][1]).toEqual([]);
        expect(result).toEqual({ rows: [{ id: 1 }], total: 5 });
    });

    test('list with status adds WHERE', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ id: 2 }]]).mockResolvedValueOnce([[{ total: 1 }]]);
        const repo = createFeedbackRepository(pool);

        const result = await repo.list({ page: 1, limit: 10, status: 'pending' });

        expect(pool.execute).toHaveBeenCalledTimes(2);
        expect(pool.execute.mock.calls[0][0]).toMatch(/WHERE status = \?/i);
        expect(pool.execute.mock.calls[0][1]).toEqual(['pending', 10, 0]);
        expect(pool.execute.mock.calls[1][1]).toEqual(['pending']);
        expect(result).toEqual({ rows: [{ id: 2 }], total: 1 });
    });

    test('updateById updates fields and returns affectedRows', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createFeedbackRepository(pool);

        const result = await repo.updateById(9, { status: 'read', adminReply: 'ok' });

        expect(pool.execute).toHaveBeenCalledTimes(1);
        expect(pool.execute.mock.calls[0][0]).toMatch(/UPDATE feedback SET updated_at = NOW\(\)/i);
        expect(pool.execute.mock.calls[0][1]).toEqual(['read', 'ok', 9]);
        expect(result).toEqual({ affectedRows: 1 });
    });

    test('updateById supports updating only status or only adminReply', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createFeedbackRepository(pool);

        await repo.updateById(1, { status: 'resolved' });
        await repo.updateById(2, { adminReply: null });

        expect(pool.execute.mock.calls[0][0]).toMatch(/status = \?/i);
        expect(pool.execute.mock.calls[1][0]).toMatch(/admin_reply = \?/i);
    });
});
