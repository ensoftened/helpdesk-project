import request from "supertest";
import app from "../src/index";
import prisma from "../src/config/prisma";
import { describe, it, expect, beforeAll } from "@jest/globals";

let adminToken: string;
let agentToken: string;
let requesterToken: string;

async function login(email: string): Promise<string> {
  const r = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return r.body.data.accessToken;
}

// Each test run gets unique IDs to avoid collisions across runs
const ts = Date.now().toString(36);
const u1 = "au-" + ts + "1@t.com";
const u2 = "au-" + ts + "2@t.com";
const u3 = "au-" + ts + "3@t.com";
const u4 = "au-" + ts + "4@t.com";

beforeAll(async () => {
  adminToken = await login("admin@helpdesk.com");
  agentToken = await login("agent@helpdesk.com");
  requesterToken = await login("requester@helpdesk.com");
});

describe("Admin permission enforcement", () => {
  it("non-admins blocked", async () => {
    let r = await request(app).get("/api/admin/users").set("Authorization", "Bearer " + requesterToken);
    expect(r.status).toBe(403);
    r = await request(app).get("/api/admin/users").set("Authorization", "Bearer " + agentToken);
    expect(r.status).toBe(403);
  });
});

describe("Admin user management", () => {
  let uid: string;
  it("creates user", async () => {
    const r = await request(app).post("/api/admin/users").set("Authorization", "Bearer " + adminToken)
      .send({ email: u1, password: "testpass1", name: "T1", role: "Requester" });
    expect(r.status).toBe(201);
    uid = r.body.id;
  });
  it("lists users", async () => {
    const r = await request(app).get("/api/admin/users").set("Authorization", "Bearer " + adminToken);
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThanOrEqual(8);
  });
  it("deactivates user", async () => {
    const r = await request(app).patch("/api/admin/users/" + uid).set("Authorization", "Bearer " + adminToken)
      .send({ isActive: false });
    expect(r.status).toBe(200);
  });
});

describe("Deactivation enforcement", () => {
  it("deactivated user cannot login", async () => {
    await request(app).post("/api/admin/users").set("Authorization", "Bearer " + adminToken)
      .send({ email: u2, password: "p1234567", name: "D", role: "Requester" });
    const lr = await request(app).post("/api/auth/login").send({ email: u2, password: "p1234567" });
    const tok = lr.body.data.accessToken;
    const u = await prisma.user.findUnique({ where: { email: u2 } });
    await request(app).patch("/api/admin/users/" + u!.id).set("Authorization", "Bearer " + adminToken)
      .send({ isActive: false });
    const r = await request(app).get("/api/auth/me").set("Authorization", "Bearer " + tok);
    expect(r.status).toBe(403);
  });
});

describe("Password reset", () => {
  it("admin resets password", async () => {
    const r = await request(app).post("/api/admin/users").set("Authorization", "Bearer " + adminToken)
      .send({ email: u3, password: "oldp1234", name: "P", role: "Requester" });
    const uid = r.body.id;
    await request(app).post("/api/admin/users/" + uid + "/reset-password").set("Authorization", "Bearer " + adminToken)
      .send({ newPassword: "newp1234" });
    const r1 = await request(app).post("/api/auth/login").send({ email: u3, password: "oldp1234" });
    expect(r1.status).toBe(401);
    const r2 = await request(app).post("/api/auth/login").send({ email: u3, password: "newp1234" });
    expect(r2.status).toBe(200);
  });
});

describe("Admin CRUD", () => {
  it("team CRUD", async () => {
    const r = await request(app).post("/api/admin/teams").set("Authorization", "Bearer " + adminToken)
      .send({ name: "T-" + ts });
    expect(r.status).toBe(201);
    const d = await request(app).delete("/api/admin/teams/" + r.body.id).set("Authorization", "Bearer " + adminToken);
    expect(d.status).toBe(200);
  });
  it("category CRUD", async () => {
    const r = await request(app).post("/api/admin/categories").set("Authorization", "Bearer " + adminToken)
      .send({ name: "C-" + ts });
    expect(r.status).toBe(201);
    const d = await request(app).delete("/api/admin/categories/" + r.body.id).set("Authorization", "Bearer " + adminToken);
    expect(d.status).toBe(200);
  });
  it("priority CRUD", async () => {
    const lvl = (Date.now() % 90000) + 10;
    const r = await request(app).post("/api/admin/priorities").set("Authorization", "Bearer " + adminToken)
      .send({ name: "P-" + ts, level: lvl });
    expect(r.status).toBe(201);
    const d = await request(app).delete("/api/admin/priorities/" + r.body.id).set("Authorization", "Bearer " + adminToken);
    expect(d.status).toBe(200);
  });
  it("SLA CRUD", async () => {
    const lvl = (Date.now() % 90000) + 100;
    const pr = await request(app).post("/api/admin/priorities").set("Authorization", "Bearer " + adminToken)
      .send({ name: "SLAP-" + ts, level: lvl });
    expect(pr.status).toBe(201);
    const pid = pr.body.id;
    const r = await request(app).post("/api/admin/slas").set("Authorization", "Bearer " + adminToken)
      .send({ priorityId: pid, responseHours: 1, resolutionHours: 4 });
    expect(r.status).toBe(201);
    const d = await request(app).delete("/api/admin/slas/" + r.body.id).set("Authorization", "Bearer " + adminToken);
    expect(d.status).toBe(200);
  });
});

describe("Admin audit log", () => {
  it("logs on user creation", async () => {
    const before = await prisma.auditLog.count();
    await request(app).post("/api/admin/users").set("Authorization", "Bearer " + adminToken)
      .send({ email: u4, password: "a1234567", name: "A", role: "Requester" });
    expect(await prisma.auditLog.count()).toBeGreaterThan(before);
  });
});