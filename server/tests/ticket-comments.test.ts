// ────────────────────────────────────────────────────────────────────
// FILE: server/tests/ticket-comments.test.ts
// WHAT THIS FILE IS FOR:
//   Tests that internal comments (private notes meant for staff only)
//   are NEVER leaked to requesters. Also verifies that agents and
//   admins can see them, and that requesters cannot create them.
// HOW IT FITS INTO THE PROJECT:
//   Internal comments are a security-critical feature: if a requester
//   sees an internal note, it could expose private staff discussions.
//   These tests prove the backend correctly filters them.
// NEW CONCEPTS:
//   - "isInternal" flag: a boolean on comments that marks them as
//     staff-only. Think of it like a "private" sticker on a file.
//   - Array.some(): checks if at least one element in an array matches
//     a condition — used here to verify internal comments exist.
// ────────────────────────────────────────────────────────────────────

// Supertest: send fake HTTP requests to our Express app.
import request from "supertest";
// The Express app exported from src/index.ts.
import app from "../src/index";
// Prisma: direct database access to find seeded data (teams, etc.).
import { PrismaClient } from "@prisma/client";
// Explicit Jest imports so TypeScript resolves describe/it/expect correctly.
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

// Create a shared Prisma client for direct DB queries (finding seeded data).
const prisma = new PrismaClient();

// Helper: logs in as a seeded user and returns just the access token.
async function loginAs(email: string): Promise<string> {
  // POST /api/auth/login with the known seed password.
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  // Extract and return the short-lived access token.
  return res.body.data.accessToken;
}

// Group all internal comment protection tests.
describe("Internal Comment Protection", () => {
  // Tokens for the three roles, set in beforeAll.
  let requesterToken: string;
  let agentToken: string;
  let adminToken: string;

  // Before all tests: log in as each role and store their tokens.
  beforeAll(async () => {
    requesterToken = await loginAs("requester@helpdesk.com");
    agentToken = await loginAs("agent@helpdesk.com");
    adminToken = await loginAs("admin@helpdesk.com");
  });

  // After all tests: disconnect Prisma to clean up.
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Test: when a requester fetches their ticket, internal comments
  // must be filtered out. They should only see public comments.
  it("Requesters never see internal comments", async () => {
    // Look up seeded data IDs needed to create a ticket.
    const priority = await prisma.priority.findFirst();
    const category = await prisma.category.findFirst();
    const supportTeam = await prisma.team.findUnique({
      where: { name: "IT Support" },
    });
    // Create a ticket as the requester.
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        title: "InternalTest",
        description: "Desc",
        priorityId: priority!.id,
        categoryId: category!.id,
        teamId: supportTeam!.id,
      })
      .expect(201);
    const ticketId = created.body.data.id;

    // Agent adds a public comment (isInternal = false).
    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "Public reply", isInternal: false })
      .expect(201);

    // Agent adds an internal comment (isInternal = true).
    // This should be HIDDEN from the requester.
    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "INTERNAL NOTE", isInternal: true })
      .expect(201);

    // The requester fetches the ticket with comments.
    const ticket = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    const comments = ticket.body.data.comments;
    // The requester should see exactly 1 comment (the public one only).
    expect(comments.length).toBe(1);
    // That one comment should be the public reply, not the internal note.
    expect(comments[0].body).toBe("Public reply");
  });

  // Test: both agents and admins should see internal comments.
  it("Agents and Admins see internal comments", async () => {
    // Look up seeded data IDs for ticket creation.
    const priority = await prisma.priority.findFirst();
    const category = await prisma.category.findFirst();
    const supportTeam = await prisma.team.findUnique({
      where: { name: "IT Support" },
    });
    // Create a ticket.
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        title: "InternalVisible",
        description: "Desc",
        priorityId: priority!.id,
        categoryId: category!.id,
        teamId: supportTeam!.id,
      })
      .expect(201);
    const ticketId = created.body.data.id;

    // Agent posts an internal comment.
    await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "Internal note", isInternal: true })
      .expect(201);

    // Agent fetches the ticket — should see the internal comment.
    const asAgent = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(200);
    // Array.some() returns true if at least one comment has isInternal = true.
    const hasInternal = asAgent.body.data.comments.some(
      (c: any) => c.isInternal
    );
    expect(hasInternal).toBe(true);

    // Admin fetches the ticket — should also see the internal comment.
    const asAdmin = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const hasInternal2 = asAdmin.body.data.comments.some(
      (c: any) => c.isInternal
    );
    expect(hasInternal2).toBe(true);
  });

  // Test: requesters should NOT be allowed to create internal comments.
  // Only agents and admins should be able to set isInternal = true.
  it("Requesters cannot post internal comments", async () => {
    // Look up seeded data IDs.
    const priority = await prisma.priority.findFirst();
    const category = await prisma.category.findFirst();
    const supportTeam = await prisma.team.findUnique({
      where: { name: "IT Support" },
    });
    // Create a ticket.
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        title: "NoInternal",
        description: "Desc",
        priorityId: priority!.id,
        categoryId: category!.id,
        teamId: supportTeam!.id,
      })
      .expect(201);
    // The requester tries to post a comment with isInternal = true.
    // This should be rejected with HTTP 403 Forbidden.
    await request(app)
      .post(`/api/tickets/${created.body.data.id}/comments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ body: "Trying internal", isInternal: true })
      .expect(403);
  });
});