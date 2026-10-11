// ────────────────────────────────────────────────────────────────────
// FILE: server/tests/ticket-transitions.test.ts
// WHAT THIS FILE IS FOR:
//   Tests that ticket status transitions follow the allowed workflow.
//   Every status change must go through valid paths (e.g., Open→InProgress
//   is allowed, but Open→Closed is rejected). Also tests that role-based
//   restrictions apply to status changes.
// HOW IT FITS INTO THE PROJECT:
//   The ticket workflow is defined in /docs/workflow.md. These tests
//   prove the backend enforces those rules — both the valid transitions
//   and the invalid ones that should be blocked.
// NEW CONCEPTS:
//   - "TicketStatus" is a Prisma enum: each ticket has exactly one
//     status at a time (Open, In_Progress, Waiting_on_Requester,
//     Resolved, Closed, Reopened).
//   - "State machine": a system where you can only move from one state
//     to another through specific allowed paths — like a board game
//     where you can't skip squares.
// ────────────────────────────────────────────────────────────────────

// Supertest: simulate HTTP requests against our Express app.
import request from "supertest";
// The Express app — imported from the main entry point.
import app from "../src/index";
// Prisma client for direct DB queries + TicketStatus enum for type safety.
import { PrismaClient, TicketStatus } from "@prisma/client";
// Explicit Jest imports: describe, it, expect, beforeAll, afterAll.
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
// Create one shared Prisma client instance for direct DB queries.
// We use this to look up team/priority/category IDs from the seed data.
const prisma = new PrismaClient();

// Helper: logs in as a given seeded user and returns the access token.
// This avoids repeating the login request in every test.
// "email" is the seeded user's email, password is always "password123".
async function loginAs(email: string): Promise<string> {
  // POST /api/auth/login with the email and the known seed password.
  const r = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  // Return just the short-lived access token string.
  return r.body.data.accessToken;
}

// Declare variables to hold the three role tokens.
// They get assigned in beforeAll below, before any tests run.
let agentT: string;   // token for the Agent user
let adminT: string;   // token for the Admin user
let reqT: string;     // token for the Requester user

// beforeAll runs ONCE before all tests in this file.
// We log in as all three roles and store their tokens.
beforeAll(async () => {
  agentT = await loginAs("agent@helpdesk.com");
  adminT = await loginAs("admin@helpdesk.com");
  reqT = await loginAs("requester@helpdesk.com");
});

// afterAll runs ONCE after all tests finish.
// We close the Prisma connection to avoid hanging resources.
afterAll(async () => {
  await prisma.$disconnect();
});

// Helper: creates a ticket and walks it through valid transitions
// until it reaches the desired status "s". Returns the ticket ID.
// "team" defaults to "IT Support" but can be overridden (e.g., "Operations").
async function ticketInStatus(
  s: TicketStatus,            // the target status we want the ticket to end up in
  team: string = "IT Support" // which team the ticket belongs to
): Promise<string> {
  // Find the team record by name (from the seed data).
  const tm = await prisma.team.findUnique({ where: { name: team } });
  // Grab any priority and category — we just need valid IDs.
  // The "!" tells TypeScript we're sure this will not be null.
  const p = (await prisma.priority.findFirst())!;
  const c = (await prisma.category.findFirst())!;
  // Create a new ticket as admin (admins can assign any team).
  const r = await request(app)
    .post("/api/tickets")
    .set("Authorization", `Bearer ${adminT}`) // admin token
    .send({
      title: "X",
      description: "Y",
      priorityId: p.id,
      categoryId: c.id,
      teamId: tm!.id,                         // assign to the given team
    })
    .expect(201);                             // expect HTTP 201 Created
  // Extract the newly created ticket's ID.
  const id = r.body.data.id;

  // Build a list of status transitions needed to reach the target.
  // Open→InProgress→Resolved→Closed→Reopened (only the necessary steps).
  const steps: TicketStatus[] = [];
  if (s === TicketStatus.In_Progress)
    steps.push(TicketStatus.In_Progress);
  else if (s === TicketStatus.Waiting_on_Requester)
    steps.push(TicketStatus.Waiting_on_Requester);
  else if (s === TicketStatus.Resolved)
    steps.push(TicketStatus.In_Progress, TicketStatus.Resolved);
  else if (s === TicketStatus.Closed)
    steps.push(TicketStatus.In_Progress, TicketStatus.Resolved, TicketStatus.Closed);
  else if (s === TicketStatus.Reopened)
    steps.push(TicketStatus.In_Progress, TicketStatus.Resolved, TicketStatus.Closed, TicketStatus.Reopened);

  // Walk through each step in order, updating the ticket status.
  for (const step of steps) {
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${adminT}`) // admin can do any transition
      .send({ status: step })
      .expect(200);                             // each step must succeed
  }
  return id; // return the ticket ID for the test to use
}

// ── TRANSITION TESTS ──────────────────────────────────────────────
// Tests for valid and invalid status transitions on tickets.
describe("Transition tests", () => {
  // T1: Agent should be able to move an Open ticket to In Progress.
  it("Agent: Open→InProgress(T1)", async () => {
    const id = await ticketInStatus(TicketStatus.Open); // get an Open ticket
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${agentT}`) // agent token
      .send({ status: TicketStatus.In_Progress })
      .expect(200); // expect success
  });

  // T2: Agent can move Open → Waiting on Requester.
  it("Agent: Open→WaitingOnReq(T2)", async () => {
    const id = await ticketInStatus(TicketStatus.Open);
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${agentT}`)
      .send({ status: TicketStatus.Waiting_on_Requester })
      .expect(200);
  });

  // T4: Agent can move In Progress → Resolved.
  it("Agent: InProgress→Resolved(T4)", async () => {
    const id = await ticketInStatus(TicketStatus.In_Progress); // pre-transitioned
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${agentT}`)
      .send({ status: TicketStatus.Resolved })
      .expect(200);
  });

  // T7: Agent can move Resolved → Closed.
  it("Agent: Resolved→Closed(T7)", async () => {
    const id = await ticketInStatus(TicketStatus.Resolved); // pre-transitioned
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${agentT}`)
      .send({ status: TicketStatus.Closed })
      .expect(200);
  });
  // ── INVALID TRANSITIONS (should all be rejected) ──────────────

  // Skipping from Open directly to Closed is not allowed.
  it("Rejected: Open→Closed", async () => {
    const id = await ticketInStatus(TicketStatus.Open);
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${adminT}`)
      .send({ status: TicketStatus.Closed })
      .expect(400); // expect HTTP 400 Bad Request (invalid transition)
  });

  // Skipping from Open directly to Resolved is not allowed.
  it("Rejected: Open→Resolved", async () => {
    const id = await ticketInStatus(TicketStatus.Open);
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${adminT}`)
      .send({ status: TicketStatus.Resolved })
      .expect(400);
  });

  // Skipping from In Progress directly to Closed is not allowed.
  // Must go through Resolved first.
  it("Rejected: InProgress→Closed", async () => {
    const id = await ticketInStatus(TicketStatus.In_Progress);
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${adminT}`)
      .send({ status: TicketStatus.Closed })
      .expect(400);
  });

  // Trying to "change" to the same status should be rejected.
  it("Rejected: same status", async () => {
    const id = await ticketInStatus(TicketStatus.Open);
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${adminT}`)
      .send({ status: TicketStatus.Open }) // same as current
      .expect(400);
  });
  // ── ROLE-BASED RESTRICTIONS ────────────────────────────────────

  // Requesters should NOT be able to move tickets to In Progress.
  it("Role: Requester cannot Open→InProgress", async () => {
    // Look up priority and category for the ticket creation payload.
    const p = (await prisma.priority.findFirst())!;
    const c = (await prisma.category.findFirst())!;
    // Create a ticket as the requester.
    const r = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${reqT}`) // requester token
      .send({ title: "X", description: "Y", priorityId: p.id, categoryId: c.id })
      .expect(201);
    // Try to move it to In Progress as requester — should fail.
    await request(app)
      .patch(`/api/tickets/${r.body.data.id}/status`)
      .set("Authorization", `Bearer ${reqT}`)
      .send({ status: TicketStatus.In_Progress })
      .expect(400); // expect rejection
  });

  // Only admins can reopen tickets (Closed → Reopened).
  it("Role: Agent cannot Closed→Reopened(T8)", async () => {
    const id = await ticketInStatus(TicketStatus.Closed);
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${agentT}`) // agent token, not admin
      .send({ status: TicketStatus.Reopened })
      .expect(400); // agent should be rejected
  });

  // Agents can only touch tickets belonging to their own team.
  it("Role: Agent cannot touch other team", async () => {
    // Create a ticket in "Operations" team (agent is in "IT Support").
    const id = await ticketInStatus(TicketStatus.Open, "Operations");
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${agentT}`) // IT Support agent
      .send({ status: TicketStatus.In_Progress })
      .expect(403); // expect HTTP 403 Forbidden (wrong team)
  });

  // A requester CAN close their own ticket once resolved.
  it("Requester: can close own resolved ticket (T7)", async () => {
    // Look up priority and category for the ticket creation.
    const p = (await prisma.priority.findFirst())!;
    const c = (await prisma.category.findFirst())!;
    // Create a ticket as the requester.
    const r = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${reqT}`)
      .send({ title: "CloseMe", description: "Mine", priorityId: p.id, categoryId: c.id })
      .expect(201);
    const id = r.body.data.id;
    // Admin moves it to In Progress (requester can't do this step).
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${adminT}`)
      .send({ status: TicketStatus.In_Progress })
      .expect(200);
    // Admin moves it to Resolved.
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${adminT}`)
      .send({ status: TicketStatus.Resolved })
      .expect(200);
    // Now the requester closes their own resolved ticket.
    await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set("Authorization", `Bearer ${reqT}`)
      .send({ status: TicketStatus.Closed })
      .expect(200); // requester IS allowed to close their own resolved ticket
  });
});