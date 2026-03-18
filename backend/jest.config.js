module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/**/*.test.js'],
    collectCoverage: true,
    collectCoverageFrom: ['<rootDir>/business/models/**/*.js'],
    coverageThreshold: {
        './business/models/': {
            lines: 80,
            functions: 80,
            statements: 80,
            branches: 60,
        },
    },
};
