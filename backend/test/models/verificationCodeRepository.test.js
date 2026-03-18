const createVerificationCodeRepository = require('../../business/models/verificationCodeRepository');

function createPoolMock() {
    return {
        execute: jest.fn(),
    };
}

describe('verificationCodeRepository', () => {
    test('upsert writes code with type and expiry', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createVerificationCodeRepository(pool);

        const expiresAt = new Date('2030-01-01T00:00:00.000Z');
        await repo.upsert({ email: 'a@b.com', code: '1234', type: 'register', expiresAt });

        expect(pool.execute.mock.calls[0][0]).toMatch(/INSERT INTO verification_codes/i);
        expect(pool.execute.mock.calls[0][1]).toEqual(['a@b.com', '1234', 'register', expiresAt]);
    });

    test('findValid returns first row or null', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);
        const repo = createVerificationCodeRepository(pool);

        const found = await repo.findValid({ email: 'a', code: 'c', type: 't' });

        expect(pool.execute.mock.calls[0][0]).toMatch(/expires_at > NOW\(\)/i);
        expect(pool.execute.mock.calls[0][1]).toEqual(['a', 'c', 't']);
        expect(found).toEqual({ id: 1 });
    });

    test('markUsed updates used flag', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createVerificationCodeRepository(pool);

        await repo.markUsed(9);

        expect(pool.execute).toHaveBeenCalledWith('UPDATE verification_codes SET used = 1 WHERE id = ?', [9]);
    });
});
