// Test setup: runs before every test suite.
// Sets environment variables for test mode.
// Uses the existing dev.db (already seeded via `npm run db:setup`).
// In production, you'd use a dedicated test database.

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./dev.db";