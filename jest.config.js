module.exports = {
    preset: 'ts-jest',
    testMatch: ['**/*.test.js'],
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
    '!**/components/**',
  ],
};