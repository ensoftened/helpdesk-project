// ────────────────────────────────────────────────────────────────────
// FILE: server/tests/auth.test.ts
// WHAT THIS FILE IS FOR:
//   Automated tests for the authentication endpoints (register, login,
//   refresh, logout, and "me"). These tests make real HTTP calls to the
//   Express app using Supertest and verify the responses.
// HOW IT FITS INTO THE PROJECT:
//   This is part of the test suite in /server/tests. Jest is the test
//   runner (it finds *.test.ts files, runs them, and reports results).
//   These tests run against the seeded dev database, so seeded users
//   like "requester@helpdesk.com" already exist before the tests run.
// NEW CONCEPTS:
//   - "Jest" is like a robot that executes your tests and tells you
//     which ones passed or failed.
//   - "Supertest" is a helper that turns your Express app into
//     something you can send fake HTTP requests to — no real server
//     listening on a port needed.
//   - "Bearer token" is a secret string the server gives you after
//     login; you send it back in the Authorization header to prove
//     who you are (like a wristband at a festival).
//   - "describe" and "it" are Jest functions for grouping and naming
//     tests. "expect" is how you assert what the result *should* be.
// ────────────────────────────────────────────────────────────────────

// Supertest lets us send fake HTTP requests to our Express app.
import request from "supertest";
// Import the Express app object from the main entry point.
// It is exported as "export default app" in src/index.ts.
import app from "../src/index";
// Explicitly import Jest's global helpers so TypeScript and our IDE
// know where "describe", "it", "expect", etc. come from.
// This fixes the "Cannot find name 'describe'" TS errors.
import { describe, it, expect } from "@jest/globals";

// Group all authentication-related tests under one "describe" block.
// The string is the label that appears in the test report.
describe("Authentication", () => {
  // Create a unique email address for the registration tests.
  // Date.now() returns the current timestamp in milliseconds,
  // so the email will be different every time the tests run.
  // This avoids collisions with already-registered users.
  const testEmail = `test-${Date.now()}@test.com`;

  // ── REGISTER TESTS ────────────────────────────────────────────────
  // Tests for POST /api/auth/register — creating a new user account.
  describe("POST /api/auth/register", () => {
    // Test: a happy-path registration with valid data.
    it("Registers a new user", async () => {
      // Send a POST request to the register endpoint with valid fields.
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,       // unique email generated above
          password: "password123", // 11 chars, well above the 6-char minimum
          name: "Test User",      // any non-empty string is valid
        })
        .expect(201);              // expect HTTP 201 Created
      // The response body should contain the new user's email.
      expect(res.body.data.email).toBe(testEmail);
      // Every new user is created with the "Requester" role by default.
      expect(res.body.data.role).toBe("Requester");
    });

    // Test: registering with an email that already exists.
    it("Rejects duplicate email", async () => {
      // Try to register again with the same email as the test above.
      // Since the first test already created this user, the server
      // should reject this with a 409 Conflict status.
      await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,       // same email — already taken
          password: "password123",
          name: "Test User",
        })
        .expect(409);              // expect HTTP 409 Conflict
    });

    // Test: an email that doesn't look like a real email address.
    it("Rejects invalid email", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          email: "notanemail",    // no "@" symbol — Zod's .email() rejects it
          password: "password123",
          name: "User",
        })
        .expect(400);              // expect HTTP 400 Bad Request (validation error)
    });

    // Test: a password shorter than the 6-character minimum.
    it("Rejects short password", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          email: "new@test.com",  // a fresh, valid email
          password: "12",          // only 2 characters — fails .min(6) in Zod
          name: "User",
        })
        .expect(400);              // expect HTTP 400 Bad Request
    });
  });

  // ── LOGIN TESTS ───────────────────────────────────────────────────
  // Tests for POST /api/auth/login — getting access and refresh tokens.
  describe("POST /api/auth/login", () => {
    // Test: logging in with the correct email and password.
    // "requester@helpdesk.com" is a user seeded into the dev database.
    it("Logs in with correct credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "requester@helpdesk.com", // seeded user
          password: "password123",          // the password set in the seed script
        })
        .expect(200);                        // expect HTTP 200 OK
      // A successful login returns both an access token (short-lived)
      // and a refresh token (long-lived, used to get new access tokens).
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    // Test: logging in with the right email but wrong password.
    it("Rejects wrong password", async () => {
      await request(app)
        .post("/api/auth/login")
        .send({
          email: "requester@helpdesk.com", // user exists
          password: "wrong",                // but password doesn't match the hash
        })
        .expect(401);                        // expect HTTP 401 Unauthorized
    });

    // Test: logging in with an email that doesn't belong to any user.
    it("Rejects non-existent user", async () => {
      await request(app)
        .post("/api/auth/login")
        .send({
          email: "nobody@test.com",   // this email has never been registered
          password: "password123",
        })
        .expect(401);                  // expect HTTP 401 Unauthorized
    });
  });

  // ── "ME" ENDPOINT TESTS ───────────────────────────────────────────
  // Tests for GET /api/auth/me — getting the currently logged-in user's info.
  describe("GET /api/auth/me", () => {
    // Test: sending a valid access token should return the user's profile.
    it("Returns user info with valid token", async () => {
      // First, log in to get a valid access token.
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: "requester@helpdesk.com",
          password: "password123",
        });
      // Extract the access token from the login response body.
      const token = loginRes.body.data.accessToken;
      // Now call the /me endpoint, sending the token in the
      // Authorization header using the "Bearer" scheme.
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)  // attach the token
        .expect(200);                              // expect HTTP 200 OK
      // The response should contain the email of the logged-in user.
      expect(res.body.data.email).toBe("requester@helpdesk.com");
    });

    // Test: calling /me without any token should be rejected.
    it("Rejects without token", async () => {
      // No Authorization header at all — the "authenticate" middleware
      // should catch this and return 401 Unauthorized.
      await request(app).get("/api/auth/me").expect(401);
    });
  });
});