// Dashboard service: SQL aggregate stats for the admin dashboard.

import prisma from "../config/prisma";

export async function getDashboardStats() {
  const now = new Date();

  // -- Total tickets
  const totalTickets = await prisma.ticket.count();

  // -- Tickets grouped by status (only non-Closed -> open)
  const statusGroups = await prisma.ticket.groupBy({ by: ["status"], _count: { status: true } });
  const openTicketsByStatus: Record<string,number> = {};
  for (const g of statusGroups) {
    if (g.status !== "Closed") openTicketsByStatus[g.status] = g._count.status;
  }

  // -- Average resolution time (Closed tickets only)
  const closed = await prisma.ticket.findMany({
    where: { status: "Closed" },
    select: { createdAt: true, updatedAt: true },
  });
  let avgResolutionHours = 0;
  if (closed.length > 0) {
    const totalMs = closed.reduce((sum, t) => sum + ((t.updatedAt as Date).getTime() - t.createdAt.getTime()), 0);
    avgResolutionHours = totalMs / closed.length / 3600000;
  }

  // -- Overdue count (past dueAt, not closed)
  const overdueCount = await prisma.ticket.count({
    where: { dueAt: { not: null, lt: now }, status: { not: "Closed" } },
  });

  // -- Tickets per agent
  const agentTickets = await prisma.user.findMany({
    where: { role: { in: ["Agent", "Admin"] } },
    select: {
      id: true, name: true, email: true,
      _count: { select: { assignedTickets: true } },
      assignedTickets: {
        where: { status: { not: "Closed" } },
        select: { id: true },
      },
    },
  });
  const ticketsPerAgent = agentTickets.map(a => ({
    id: a.id,
    name: a.name,
    email: a.email,
    totalAssigned: a._count.assignedTickets,
    openAssigned: a.assignedTickets.length,
  }));

  return { totalTickets, openTicketsByStatus, averageResolutionTimeHours: Math.round(avgResolutionHours * 100) / 100, overdueCount, ticketsPerAgent };
}
