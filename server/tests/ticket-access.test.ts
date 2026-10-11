// ────────────────────────────────────────────────────────────────────
// FILE: server/tests/ticket-access.test.ts
// WHAT THIS FILE IS FOR:
//   Tests that enforce role-based access control (RBAC) on tickets.
//   It verifies who can create, list, and view individual tickets
//   based on their role: Requester, Agent, or Admin.
// HOW IT FITS INTO THE PROJECT:
//   These tests run against the seeded dev database. They prove that
//   the backend permission middleware correctly enforces the rules
//   defined in /docs/permissions.md.
// NEW CONCEPTS:
//   - "RBAC" (Role-Based Access Control): different user roles have
//     different permissions — like keys that open different doors.
//   - "beforeAll" / "afterAll": Jest hooks that run once before/after
//     all tests in the describe block (good for one-time setup/cleanup).
//   - "PrismaClient": a direct connection to the database, used here
//     to look up IDs of seeded data (teams, priorities, categories).
// ────────────────────────────────────────────────────────────────────

// Supertest: send fake HTTP requests to our Express app without a real server.
import request from "supertest";
// The Express app (exported as default from src/index.ts).
import app from "../src/index";
// Prisma client: lets us query the database directly to find seeded data.
import { PrismaClient } from "@prisma/client";
// Explicit Jest imports so TypeScript knows where describe/it/expect come from.
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

// Create a shared Prisma client for direct database queries.
const prisma = new PrismaClient();

// Helper: log in as a seeded user and return just the access token.
// This avoids duplicating the login request across tests.
async function loginAs(email: string): Promise<string> {
  // POST /api/auth/login with the known seed password "password123".
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  // The server returns { data: { accessToken, refreshToken } }.
  // We only need the short-lived access token.
  return res.body.data.accessToken;
}

// Group all ticket access control tests.
describe("Ticket Access Control", () => {
  // Variables to hold tokens and IDs, set in beforeAll.
  let requesterToken: string;  // access token for the Requester user
  let agentToken: string;      // access token for the Agent user
  let adminToken: string;      // access token for the Admin user
  let requesterId: string;     // the UUID of the Requester user
  let supportTeamId: string;   // the UUID of the "IT Support" team
  let priorityId: string;      // any valid priority UUID (from seed data)
  let categoryId: string;      // any valid category UUID (from seed data)

  // beforeAll runs once before all tests in this describe block.
  // We log in as all three roles and look up IDs from the seeded database.
  beforeAll(async () => {
    // Log in as each role and store the tokens.
    requesterToken = await loginAs("requester@helpdesk.com");
    agentToken = await loginAs("agent@helpdesk.com");
    adminToken = await loginAs("admin@helpdesk.com");
    // Look up the requester's user record to get their UUID.
    const requester = await prisma.user.findUnique({
      where: { email: "requester@helpdesk.com" },
    });
    // Look up the "IT Support" team (the agent's team).
    const supportTeam = await prisma.team.findUnique({
      where: { name: "IT Support" },
    });
    // Grab any priority and category — we just need valid UUIDs.
    const priority = await prisma.priority.findFirst();
    const category = await prisma.category.findFirst();
    // "!" asserts that these values are not null (they must exist in seed data).
    requesterId = requester!.id;
    supportTeamId = supportTeam!.id;
    priorityId = priority!.id;
    categoryId = category!.id;
  });

  // afterAll runs once after all tests finish.
  // Disconnect Prisma to release the database connection.
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── CREATE TICKET TESTS ────────────────────────────────────────
  // Tests for POST /api/tickets — who can create tickets.
  describe("POST /api/tickets", () => {
    // A requester creating a ticket — their ID should be set as requesterId.
    it("Requester creates ticket — requesterId matches", async () => {
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${requesterToken}`) // requester's token
        .send({
          title: "A",
          description: "B",
          priorityId,
          categoryId,
          // No teamId — the server auto-assigns based on category defaults
        })
        .expect(201); // expect HTTP 201 Created
      // The ticket's requesterId must match the logged-in user's ID.
      expect(res.body.data.requesterId).toBe(requesterId);
    });

    // An agent creating a ticket — the team should be auto-assigned.
    it("Agent creates ticket — team is auto-assigned", async () => {
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${agentToken}`) // agent's token
        .send({
          title: "A",
          description: "B",
          priorityId,
          categoryId,
        })
        .expect(201);
      // The ticket should automatically belong to the agent's team.
      expect(res.body.data.teamId).toBe(supportTeamId);
    });

    // No token at all — should be rejected.
    it("No token returns 401", async () => {
      await request(app)
        .post("/api/tickets")
        // No .set("Authorization", ...) — no token provided
        .send({
          title: "A",
          description: "B",
          priorityId,
          categoryId,
        })
        .expect(401); // expect HTTP 401 Unauthorized
    });
  });
// ── LIST TICKETS TESTS ──────────────────────────────────────────
  // Tests for GET /api/tickets — who can see which tickets in the list.
  describe("GET /api/tickets (list)", () => {
    // Requesters should only see tickets they created.
    it("Requester sees only own tickets", async () => {
      const res = await request(app)
        .get("/api/tickets")
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(200);
      // Every ticket in the response must have the requester's ID.
      for (const t of res.body.data) {
        expect(t.requesterId).toBe(requesterId);
      }
    });

    // Agents should only see tickets assigned to their team.
    it("Agent sees only team tickets", async () => {
      const res = await request(app)
        .get("/api/tickets")
        .set("Authorization", `Bearer ${agentToken}`)
        .expect(200);
      // Every ticket must belong to the agent's team (IT Support).
      for (const t of res.body.data) {
        expect(t.teamId).toBe(supportTeamId);
      }
    });

    // Admins should see ALL tickets.
    it("Admin sees all tickets", async () => {
      const adminRes = await request(app)
        .get("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      // The list should have at least one ticket (from seed or prior tests).
      expect(adminRes.body.data.length).toBeGreaterThan(0);
    });
  });

  // ── GET SINGLE TICKET TESTS ────────────────────────────────────
  // Tests for GET /api/tickets/:id — who can view a specific ticket.
  describe("GET /api/tickets/:id", () => {
    // Requesters should NOT see tickets created by other users.
    it("Requester cannot see another's ticket", async () => {
      // Create a ticket as the requester user.
      const created = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${requesterToken}`)
        .send({
          title: "Private",
          description: "Mine",
          priorityId,
          categoryId,
        });
      // Log in as a different user ("dave@company.com" from seed data).
      const daveToken = await loginAs("dave@company.com");
      // Dave tries to view the requester's ticket — should be forbidden.
      await request(app)
        .get(`/api/tickets/${created.body.data.id}`)
        .set("Authorization", `Bearer ${daveToken}`)
        .expect(403); // expect HTTP 403 Forbidden
    });

    // Agents should NOT see tickets from other teams.
    it("Agent cannot see other team's ticket", async () => {
      // Find the "Operations" team (different from agent's "IT Support").
      const opsTeam = await prisma.team.findUnique({
        where: { name: "Operations" },
      });
      // Create a ticket in the Operations team as admin.
      const created = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Ops",
          description: "X",
          priorityId,
          categoryId,
          teamId: opsTeam!.id, // explicitly assign to Operations
        });
      // The IT Support agent tries to view it — should be forbidden.
      await request(app)
        .get(`/api/tickets/${created.body.data.id}`)
        .set("Authorization", `Bearer ${agentToken}`)
        .expect(403); // expect HTTP 403 Forbidden
    });

    // Admins can see any ticket, regardless of owner or team.
    it("Admin can see any ticket", async () => {
      // Create a ticket as the requester.
      const created = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${requesterToken}`)
        .send({
          title: "Any",
          description: "X",
          priorityId,
          categoryId,
        });
      // Admin should be able to view it without restriction.
      await request(app)
        .get(`/api/tickets/${created.body.data.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200); // expect HTTP 200 OK
    });
  });
});