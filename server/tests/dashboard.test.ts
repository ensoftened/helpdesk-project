import request from "supertest";
import app from "../src/index";
import prisma from "../src/config/prisma";
import { describe, it, expect, beforeAll } from "@jest/globals";

let adminToken: string;
let agentToken: string;
let requesterToken: string;

beforeAll(async () => {
  const lr = async (e: string) => {
    const r = await request(app).post("/api/auth/login").send({ email: e, password: "password123" });
    return r.body.data.accessToken;
  };
  adminToken = await lr("admin@helpdesk.com");
  agentToken = await lr("agent@helpdesk.com");
  requesterToken = await lr("requester@helpdesk.com");
});

describe("Dashboard access", () => {
  it("admin can access", async () => {
    const r = await request(app).get("/api/dashboard").set("Authorization", "Bearer " + adminToken);
    expect(r.status).toBe(200);
  });
  it("agent blocked", async () => {
    const r = await request(app).get("/api/dashboard").set("Authorization", "Bearer " + agentToken);
    expect(r.status).toBe(403);
  });
  it("requester blocked", async () => {
    const r = await request(app).get("/api/dashboard").set("Authorization", "Bearer " + requesterToken);
    expect(r.status).toBe(403);
  });
});

describe("Dashboard data", () => {
  let d: {
    totalTickets: number;
    openTicketsByStatus: Record<string, number>;
    averageResolutionTimeHours: number;
    overdueCount: number;
    ticketsPerAgent: unknown[];
  };
  beforeAll(async () => {
    const r = await request(app).get("/api/dashboard").set("Authorization", "Bearer " + adminToken);
    d = r.body;
  });
  it("has totalTickets", () => {
    expect(typeof d.totalTickets).toBe("number");
    expect(d.totalTickets).toBeGreaterThan(0);
  });
  it("has openTicketsByStatus", () => {
    expect(d.openTicketsByStatus).toBeDefined();
    expect(typeof d.openTicketsByStatus).toBe("object");
  });
  it("openTicketsByStatus sum matches DB", async () => {
    const total = Object.values(d.openTicketsByStatus as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    const dbOpen = await prisma.ticket.count({ where: { status: { not: "Closed" } } });
    expect(total).toBe(dbOpen);
  });
  it("averageResolutionTimeHours is number", () => {
    expect(typeof d.averageResolutionTimeHours).toBe("number");
  });
  it("overdueCount is number", () => {
    expect(typeof d.overdueCount).toBe("number");
  });
  it("ticketsPerAgent is array", () => {
    expect(Array.isArray(d.ticketsPerAgent)).toBe(true);
  });
});