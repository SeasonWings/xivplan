module.exports = {
    toUserVO(user) {
        if (!user) return null;
        return {
            userId: user.user_id ?? user.userId,
            username: user.username,
            email: user.email,
            avatar: user.avatar ?? null,
            bio: user.bio ?? null,
            role: user.role,
            isVerified: Boolean(user.is_verified),
            emailVerified: Boolean(user.email_verified),
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        };
    },
};
