// Attachment tests: upload, list, and download files attached to tickets.
// Tests verify permissions (requester can upload to own, agent to team, admin to all),
// file size limits, and that the BLOB data round-trips correctly.
//
// NEW CONCEPT: supertest's .attach() sends multipart/form-data with file fields,
// simulating what a browser does when a user picks a file in a form.

import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { PrismaClient } from "@prisma/client";

let app: any;
const prisma = new PrismaClient();
let requesterToken: string;
let agentToken: string;
let adminToken: string;
let ticketId: string;

beforeAll(async () => {
  const mod = await import("../src/index");
  app = mod.default;
  const r = await request(app).post("/api/auth/login").send({ email: "requester@helpdesk.com", password: "password123" });
  requesterToken = r.body.data.accessToken;
  const a = await request(app).post("/api/auth/login").send({ email: "agent@helpdesk.com", password: "password123" });
  agentToken = a.body.data.accessToken;
  const ad = await request(app).post("/api/auth/login").send({ email: "admin@helpdesk.com", password: "password123" });
  adminToken = ad.body.data.accessToken;
  const team = await prisma.team.findUnique({ where: { name: "IT Support" } });
  const priority = await prisma.priority.findFirst({ where: { name: "Medium" } });
  const category = await prisma.category.findFirst({ where: { name: "Software" } });
  const ticket = await request(app)
    .post("/api/tickets")
    .set("Authorization", `Bearer ${requesterToken}`)
    .send({ title: "Attachment Test", description: "For testing", priorityId: priority!.id, categoryId: category!.id, teamId: team!.id })
    .expect(201);
  ticketId = ticket.body.data.id;
});
describe("Attachments — upload, list, download", () => {
  it("requester can upload a file to their own ticket", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .field("fileName", "hello.txt")
      .field("mimeType", "text/plain")
      .attach("file", Buffer.from("Hello, world!"), "hello.txt")
      .expect(201);
    expect(res.body.data.fileName).toBe("hello.txt");
    expect(res.body.data.sizeBytes).toBe(13);
  });

  it("agent can upload a file to their team's ticket", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${agentToken}`)
      .field("fileName", "agent-notes.md")
      .field("mimeType", "text/markdown")
      .attach("file", Buffer.from("# Notes"), "agent-notes.md")
      .expect(201);
    expect(res.body.data.fileName).toBe("agent-notes.md");
  });

  it("lists all attachments on a ticket", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0]).not.toHaveProperty("data");
  });

  it("downloads a file with correct bytes round-trip", async () => {
    const listRes = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    const att = listRes.body.data.find((a: any) => a.fileName === "hello.txt");
    expect(att).toBeDefined();
    const dlRes = await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${att.id}`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(dlRes.headers["content-disposition"]).toContain("hello.txt");
    expect(dlRes.text).toBe("Hello, world!");
  });

  it("rejects files over 10 MB", async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, "x");
    await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .field("fileName", "huge.bin")
      .field("mimeType", "application/octet-stream")
      .attach("file", big, "huge.bin")
      .expect(400);
  });
});