// This test file verifies SLA (Service Level Agreement) behavior.
// SLA rules define how fast a ticket must be resolved. Each priority+category combo
// can have a rule. We test that dueAt is computed correctly on ticket creation,
// recalculated on priority change, and that the computed isOverdue flag works.
//
// NEW CONCEPT: "overdue" means the current time is past the dueAt deadline.
// The flag is computed at query time, not stored in the database. This way
// an open ticket that was due yesterday shows as overdue without anyone
// needing to update it.
//
// Setup: the seed file already creates 8 SLA rules (4 global + 4 per-category)
// so we don't need to create our own rules for these tests.

import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { PrismaClient } from "@prisma/client";

// ─── TEST SETUP ──────────────────────────────────────────────────────────

let app: any;
const prisma = new PrismaClient();
let requesterToken: string;
let agentToken: string;
let adminToken: string;

beforeAll(async () => {
  const mod = await import("../src/index");
  app = mod.default;
  const r = await request(app).post("/api/auth/login").send({ email: "requester@helpdesk.com", password: "password123" });
  requesterToken = r.body.data.accessToken;
  const a = await request(app).post("/api/auth/login").send({ email: "agent@helpdesk.com", password: "password123" });
  agentToken = a.body.data.accessToken;
  const ad = await request(app).post("/api/auth/login").send({ email: "admin@helpdesk.com", password: "password123" });
  adminToken = ad.body.data.accessToken;
});
// ─── SLA TESTS ───────────────────────────────────────────────────────────

describe("SLA — dueAt and isOverdue", () => {
  // Test: when a ticket is created with a priority that has an SLA rule,
  // the dueAt field should be set (not null).
  it("sets dueAt when creating a ticket with an SLA rule", async () => {
    const highPriority = await prisma.priority.findFirst({ where: { name: "High" } });
    const category = await prisma.category.findFirst();
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ title: "SLA High", description: "Test SLA", priorityId: highPriority!.id, categoryId: category!.id })
      .expect(201);
    // dueAt should be set (not null) because the seeded global SLA rule for High has resolutionHours=24.
    expect(res.body.data.dueAt).not.toBeNull();
    const dueAt = new Date(res.body.data.dueAt);
    const now = new Date();
    // It should be at least 23 hours (82,800,000 ms) in the future.
    expect(dueAt.getTime()).toBeGreaterThan(now.getTime() + 82_800_000);
  });
// Test: creating a ticket with a priority that has NO SLA rule leaves dueAt null.
  it("leaves dueAt NULL when no SLA rule matches", async () => {
    // Find the "Low" priority and delete all its SLA rules temporarily.
    const lowPriority = await prisma.priority.findFirst({ where: { name: "Low" } });
    // Delete any SLA rule that matches this priority (both global and per-category).
    await prisma.sLA.deleteMany({ where: { priorityId: lowPriority!.id } });
    const category = await prisma.category.findFirst();
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ title: "No SLA", description: "No rule", priorityId: lowPriority!.id, categoryId: category!.id })
      .expect(201);
    // dueAt should be null — we deleted the SLA rules.
    expect(res.body.data.dueAt).toBeNull();
    // Recreate the Low SLA rule so other tests aren't affected.
    await prisma.sLA.create({ data: { categoryId: null, priorityId: lowPriority!.id, responseHours: 48, resolutionHours: 168 } });
  });

  // Test: changing a ticket's priority recalculates the dueAt deadline.
  it("recalculates dueAt when priority is changed", async () => {
    // "Low" has resolutionHours=168 (7 days), "Urgent" has resolutionHours=4.
    const lowPriority = await prisma.priority.findFirst({ where: { name: "Low" } });
    const urgentPriority = await prisma.priority.findFirst({ where: { name: "Urgent" } });
    const category = await prisma.category.findFirst();
    const supportTeam = await prisma.team.findUnique({ where: { name: "IT Support" } });
    // Create with Low priority — dueAt should be ~7 days from now.
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ title: "SLA Change", description: "Test", priorityId: lowPriority!.id, categoryId: category!.id, teamId: supportTeam!.id })
      .expect(201);
    const originalDueAt = new Date(created.body.data.dueAt);
    // Agent transitions + changes priority to Urgent. SLA should recalculate to ~4h.
    const updated = await request(app)
      .patch(`/api/tickets/${created.body.data.id}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "In_Progress", priorityId: urgentPriority!.id })
      .expect(200);
    const newDueAt = new Date(updated.body.data.dueAt);
    // New dueAt should be much sooner than original (4h vs 168h).
    expect(newDueAt.getTime()).toBeLessThan(originalDueAt.getTime());
    // It should be roughly 4 hours from now (at least 3 to allow drift).
    expect(newDueAt.getTime()).toBeGreaterThan(Date.now() + 3 * 60 * 60 * 1000);
  });

  // Test: isOverdue is true when dueAt is in the past.
  it("isOverdue is true when deadline has passed", async () => {
    const urgentPriority = await prisma.priority.findFirst({ where: { name: "Urgent" } });
    const category = await prisma.category.findFirst();
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ title: "Overdue", description: "Past", priorityId: urgentPriority!.id, categoryId: category!.id })
      .expect(201);
    // Manually set dueAt to 1 hour in the past via direct DB access.
    await prisma.ticket.update({
      where: { id: created.body.data.id },
      data: { dueAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    // Fetch the ticket — isOverdue computed flag should be true.
    const res = await request(app)
      .get(`/api/tickets/${created.body.data.id}`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(res.body.data.isOverdue).toBe(true);
  });

  // Test: isOverdue is false when dueAt is still in the future.
  it("isOverdue is false when deadline is still in the future", async () => {
    const lowPriority = await prisma.priority.findFirst({ where: { name: "Low" } });
    const category = await prisma.category.findFirst();
    const created = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ title: "Not overdue", description: "Future", priorityId: lowPriority!.id, categoryId: category!.id })
      .expect(201);
    // With Low priority (7-day SLA), the ticket is not overdue yet.
    expect(created.body.data.isOverdue).toBe(false);
  });
});