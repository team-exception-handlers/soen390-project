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
    ]
};