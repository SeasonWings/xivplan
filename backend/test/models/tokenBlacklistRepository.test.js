const createTokenBlacklistRepository = require('../../business/models/tokenBlacklistRepository');

function createPoolMock() {
    return {
        execute: jest.fn(),
    };
}

describe('tokenBlacklistRepository', () => {
    test('isBlacklisted returns true when rows exist', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ token: 't' }]]);
        const repo = createTokenBlacklistRepository(pool);

        const result = await repo.isBlacklisted('t');

        expect(pool.execute).toHaveBeenCalledWith('SELECT token FROM blacklisted_tokens WHERE token = ?', ['t']);
        expect(result).toBe(true);
    });

    test('isBlacklisted returns false when no rows', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[]]);
        const repo = createTokenBlacklistRepository(pool);

        const result = await repo.isBlacklisted('t');

        expect(result).toBe(false);
    });

    test('add upserts token with expiry', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createTokenBlacklistRepository(pool);

        await repo.add('t', 123);

        expect(pool.execute.mock.calls[0][0]).toMatch(/INSERT INTO blacklisted_tokens/i);
        expect(pool.execute.mock.calls[0][1]).toEqual(['t', 123]);
    });
});
