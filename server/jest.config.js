// Jest configuration for the backend test suite.
// Jest is our test runner — it finds test files, runs them, and reports results.
// This config tells Jest: use ts-jest for TypeScript, look in the tests/ folder,
// and set NODE_ENV to "test" so the server doesn't start listening on a real port.

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  setupFiles: ["<rootDir>/tests/setup.ts"],
  testMatch: ["**/*.test.ts"],
  bail: false,
  testTimeout: 10000,
};