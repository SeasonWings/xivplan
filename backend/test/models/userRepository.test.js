const createUserRepository = require('../../business/models/userRepository');

function createPoolMock() {
    return {
        execute: jest.fn(),
    };
}

describe('userRepository', () => {
    test('findByEmail returns first user', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ user_id: 'u1' }]]);
        const repo = createUserRepository(pool);

        const user = await repo.findByEmail('a@b.com');

        expect(pool.execute).toHaveBeenCalledWith('SELECT * FROM users WHERE email = ?', ['a@b.com']);
        expect(user).toEqual({ user_id: 'u1' });
    });

    test('findByEmail returns null when not found', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[]]);
        const repo = createUserRepository(pool);

        const user = await repo.findByEmail('none');
        expect(user).toBeNull();
    });

    test('existsByUsernameOrEmail returns boolean', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[{ user_id: 'u1' }]]);
        const repo = createUserRepository(pool);

        const exists = await repo.existsByUsernameOrEmail('n', 'e');

        expect(exists).toBe(true);
    });

    test('findByUsername and findById return null when empty', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
        const repo = createUserRepository(pool);

        const u1 = await repo.findByUsername('n');
        const u2 = await repo.findById('u');

        expect(u1).toBeNull();
        expect(u2).toBeNull();
    });

    test('create inserts user', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createUserRepository(pool);

        await repo.create({ userId: 'u', username: 'n', email: 'e', passwordHash: 'p' });

        expect(pool.execute.mock.calls[0][0]).toMatch(/INSERT INTO users/i);
        expect(pool.execute.mock.calls[0][1]).toEqual(['u', 'n', 'e', 'p']);
    });

    test('updatePassword methods execute', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createUserRepository(pool);

        await repo.updatePasswordByUserId('u', 'p');
        await repo.updatePasswordByEmail('e', 'p2');

        expect(pool.execute.mock.calls[0][0]).toMatch(/UPDATE users SET password_hash/i);
        expect(pool.execute.mock.calls[1][0]).toMatch(/WHERE email = \?/i);
    });

    test('updateProfile returns affectedRows', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createUserRepository(pool);

        const result = await repo.updateProfile('u', { username: 'n', avatar: null, bio: 'b' });

        expect(pool.execute.mock.calls[0][0]).toMatch(/UPDATE users SET updated_at = NOW\(\)/i);
        expect(result).toEqual({ affectedRows: 1 });
    });

    test('updateProfile supports partial updates', async () => {
        const pool = createPoolMock();
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const repo = createUserRepository(pool);

        await repo.updateProfile('u', { username: 'n' });

        expect(pool.execute.mock.calls[0][0]).toMatch(/username = \?/i);
        expect(pool.execute.mock.calls[0][0]).not.toMatch(/avatar = \?/i);
        expect(pool.execute.mock.calls[0][0]).not.toMatch(/bio = \?/i);
    });
});
