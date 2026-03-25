module.exports = {
    preset: 'ts-jest',
    testMatch: ['**/*.test.{js,ts,tsx}'],
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
    },
    reporters: [
        "default",
        ["./node_modules/jest-html-reporter", {
            "pageTitle": "Test Report",
            includeFailureMsg: true,
            includeConsoleLog: true,
            sort: 'titleAsc'
        }]
    ],
    collectCoverageFrom: [
        '**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/*.test.{ts,tsx}',
        '!**/*.spec.{ts,tsx}',
        '!**/__tests__/**',
        '!**/__mocks__/**',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/assets/**',
        '!**/constants/**',
        '!**/types/**',
        '!**/styles/**',
        '!**/theme/**',
        '!babel.config.js',
        '!metro.config.js',
        '!**/hooks/**',
        '!**/app/**',
        '!**/utils/nativeMaps.ts',
        '!**/utils/nativeMaps.web.ts',
        '!**/test/mocks/**',
    ],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 95,
            lines: 95,
            statements: 95,
        },
    },
};
