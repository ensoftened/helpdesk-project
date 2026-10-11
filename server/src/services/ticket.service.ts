// Ticket business logic: CRUD, status transitions, assignment, comments, SLA, attachments.
// Each function wraps database calls and business rules.
// NEW CONCEPT: SLA (Service Level Agreement) defines how fast a ticket must be resolved.
// We compute a 'dueAt' timestamp from the matching SLA rule and compute 'isOverdue' at query time.
import prisma from "../config/prisma";
import { isTransitionAllowed } from "../utils/constants";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors";
import { UserRole, TicketStatus } from "@prisma/client";

export interface CreateTicketInput { title: string; description: string; priorityId: string; categoryId: string; teamId?: string; }
export interface TicketFilters {
  status?: TicketStatus;
  priorityId?: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── SLA HELPERS ────────────────────────────────────────────────────────
// computeDueAt: looks up the SLA rule for a category+priority combo,
// returns now + resolutionHours. Returns null if no matching rule.
export async function computeDueAt(tx: any, priorityId: string, categoryId: string): Promise<Date | null> {
  // Step 1: try exact match (specific category + priority).
  const specificRule = await tx.sLA.findFirst({
    where: { categoryId, priorityId },
  });
  if (specificRule && specificRule.resolutionHours > 0) {
    // Add resolutionHours worth of milliseconds to the current timestamp.
    return new Date(Date.now() + specificRule.resolutionHours * 60 * 60 * 1000);
  }
  // Step 2: try global rule (NULL category = applies to all categories + matching priority).
  const globalRule = await tx.sLA.findFirst({
    where: { categoryId: null, priorityId },
  });
  if (globalRule && globalRule.resolutionHours > 0) {
    return new Date(Date.now() + globalRule.resolutionHours * 60 * 60 * 1000);
  }
  // Step 3: no matching rule — no deadline.
  return null;
}

export async function createTicket(input: CreateTicketInput, userId: string, userRole: UserRole, userTeamId: string | null, onBehalfOfUserId?: string) {
  // Determine who the ticket is really for. Requesters file for themselves;
  // Agents/Admins can file on behalf of someone else via onBehalfOfUserId.
  const requesterId = (userRole === UserRole.Requester) ? userId : (onBehalfOfUserId || userId);
  // If the creator is an Agent and no team was explicitly given, auto-assign to their team.
  const teamId = input.teamId || (userRole === UserRole.Agent ? userTeamId : null);
  const ticket = await prisma.$transaction(async (tx) => {
    // Compute the SLA deadline before creating the ticket.
    const dueAt = await computeDueAt(tx, input.priorityId, input.categoryId);
    const t = await tx.ticket.create({
      data: { title: input.title, description: input.description, status: TicketStatus.Open, priorityId: input.priorityId, categoryId: input.categoryId, requesterId, teamId, dueAt },
      include: { priority: true, category: true, requester: { select: { id: true, name: true, email: true } }, team: true, assignee: { select: { id: true, name: true, email: true } } },
    });
    // Log the creation in the audit trail.
    await tx.auditLog.create({ data: { ticketId: t.id, changedByUserId: userId, field: "created", oldValue: null, newValue: "Ticket created" } });
    return t;
  });
  return {
    ...ticket,
    isOverdue: ticket.dueAt ? ticket.dueAt.getTime() < Date.now() : false,
  };
}

// listTickets: returns tickets scoped by user role with optional:
// - Pagination (page, limit) — controls how many results and which page
// - Sorting (sortBy, sortOrder) — orders by any field, ascending or descending
// - Search (search) — matches text in title and description
// - Filters (status, priorityId, categoryId) — narrows down results
//
// Response format: { data: [...], pagination: { page, limit, total, totalPages } }
//
// NEW CONCEPT: pagination splits results into pages so you don't load
// thousands of records at once. The frontend can display "Page 1 of 10" controls.
export async function listTickets(
  userId: string,
  userRole: UserRole,
  userTeamId: string | null,
  filters: TicketFilters = {}
) {
  // ─── Build WHERE clause (role scoping + filters + search) ──────────
  const where: any = {};
  // Role-based scoping: Requesters only see their own tickets.
  if (userRole === UserRole.Requester) where.requesterId = userId;
  // Agents see only their team's tickets. No team = nothing visible.
  else if (userRole === UserRole.Agent) {
    if (userTeamId) where.teamId = userTeamId;
    else return { data: [], pagination: { page: filters.page || 1, limit: filters.limit || 20, total: 0, totalPages: 0 } };
  }
  // Optional status filter.
  if (filters.status) where.status = filters.status;
  // Optional priority filter.
  if (filters.priorityId) where.priorityId = filters.priorityId;
  // Optional category filter.
  if (filters.categoryId) where.categoryId = filters.categoryId;
  // Text search: looks for matches in title OR description (case-insensitive in SQLite).
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { description: { contains: filters.search } },
    ];
  }

  // ─── Pagination defaults ────────────────────────────────────────────
  const page = Math.max(1, filters.page || 1);   // at least page 1
  const limit = Math.min(100, Math.max(1, filters.limit || 20)); // 1–100, default 20
  const skip = (page - 1) * limit;

  // ─── Sorting ────────────────────────────────────────────────────────
  // Only allow sorting on known fields to prevent injection.
  const allowedSortFields = ["createdAt", "updatedAt", "status", "title"];
  const sortBy = allowedSortFields.includes(filters.sortBy || "") ? filters.sortBy! : "createdAt";
  const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
  const orderBy: any = { [sortBy]: sortOrder };

  // ─── Execute queries in parallel ────────────────────────────────────
  // We need both the current page of results and the total count (for pagination info).
  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where, orderBy, skip, take: limit,
      include: {
        priority: true, category: true,
        requester: { select: { id: true, name: true, email: true } },
        team: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  // Attach computed isOverdue flag to each ticket.
  const ticketsWithOverdue = tickets.map((ticket) => ({
    ...ticket,
    isOverdue: ticket.dueAt ? ticket.dueAt.getTime() < Date.now() : false,
  }));

  // Return the new response format: data + pagination metadata.
  return {
    data: ticketsWithOverdue,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
export async function getTicket(ticketId: string, userRole: UserRole) {
  // Fetch the ticket with all related data: priority, category, requester, team, assignee,
  // comments (chronological order), and audit logs.
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      priority: true, category: true,
      requester: { select: { id: true, name: true, email: true } },
      team: true,
      assignee: { select: { id: true, name: true, email: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, role: true } } } },
      auditLogs: { orderBy: { createdAt: "asc" }, include: { changedByUser: { select: { id: true, name: true } } } },
    },
  });
  // If the ticket doesn't exist, throw a 404 error.
  if (!ticket) throw new NotFoundError("Ticket not found");
  // Requesters must never see internal comments — strip them out.
  if (userRole === UserRole.Requester) ticket.comments = ticket.comments.filter((c) => !c.isInternal);
  // Attach the computed isOverdue flag (not stored in DB).
  return {
    ...ticket,
    isOverdue: ticket.dueAt ? ticket.dueAt.getTime() < Date.now() : false,
  };
}

// transitionStatus: changes the ticket's status, and optionally priority/category/team.
// All allowed changes happen in one database transaction with audit log entries.
export async function transitionStatus(
  ticketId: string,
  newStatus: TicketStatus,
  userId: string,
  userRole: UserRole,
  userTeamId: string | null,
  options?: { priorityId?: string; categoryId?: string; teamId?: string }
) {
  // Fetch the ticket — we need its current state for validation.
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true, priorityId: true, categoryId: true, teamId: true, requesterId: true } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  // Scope check: requesters can only modify their own tickets.
  if (userRole === UserRole.Requester && ticket.requesterId !== userId) throw new ForbiddenError("You can only modify your own tickets");
  // Scope check: agents can only modify tickets in their team.
  if (userRole === UserRole.Agent && (!userTeamId || ticket.teamId !== userTeamId)) throw new ForbiddenError("You can only modify tickets in your team");
  // No-op check: if nothing changes, don't waste a transaction.
  if (ticket.status === newStatus) throw new ValidationError(`Already in '${newStatus}'`);
  // Validate the status transition against the workflow rules.
  if (!isTransitionAllowed(ticket.status, newStatus, userRole)) throw new ValidationError(`Cannot change from '${ticket.status}' to '${newStatus}'`);

  // Run everything in one transaction: update ticket, compute new SLA if priority changed,
  // and write audit log entries.
  const [updated] = await prisma.$transaction(async (tx) => {
    // Build the update data object — only include fields that are being changed.
    const updateData: any = { status: newStatus };
    if (options?.priorityId && options.priorityId !== ticket.priorityId) updateData.priorityId = options.priorityId;
    if (options?.categoryId && options.categoryId !== ticket.categoryId) updateData.categoryId = options.categoryId;
    if (options?.teamId && options.teamId !== ticket.teamId) updateData.teamId = options.teamId;
    // If priority or category changed, recalculate the SLA deadline.
    const effectivePriorityId = updateData.priorityId || ticket.priorityId;
    const effectiveCategoryId = updateData.categoryId || ticket.categoryId;
    if (options?.priorityId || options?.categoryId) {
      updateData.dueAt = await computeDueAt(tx, effectivePriorityId, effectiveCategoryId);
    }

    // Perform the actual database update.
    const updatedTicket = await tx.ticket.update({ where: { id: ticketId }, data: updateData, include: { priority: true, category: true, requester: { select: { id: true, name: true, email: true } }, team: true, assignee: { select: { id: true, name: true, email: true } } } });

    // Always log the status change.
    await tx.auditLog.create({ data: { ticketId, changedByUserId: userId, field: "status", oldValue: ticket.status, newValue: newStatus } });
    // Log priority change if it happened.
    if (options?.priorityId && options.priorityId !== ticket.priorityId) {
      await tx.auditLog.create({ data: { ticketId, changedByUserId: userId, field: "priority", oldValue: ticket.priorityId, newValue: options.priorityId } });
    }
    // Log category change if it happened.
    if (options?.categoryId && options.categoryId !== ticket.categoryId) {
      await tx.auditLog.create({ data: { ticketId, changedByUserId: userId, field: "category", oldValue: ticket.categoryId, newValue: options.categoryId } });
    }
    // Log team change if it happened.
    if (options?.teamId && options.teamId !== ticket.teamId) {
      await tx.auditLog.create({ data: { ticketId, changedByUserId: userId, field: "team", oldValue: ticket.teamId || "none", newValue: options.teamId } });
    }

    return [updatedTicket];
  });
  return {
    ...updated,
    isOverdue: updated.dueAt ? updated.dueAt.getTime() < Date.now() : false,
  };
}

export async function assignTicket(ticketId: string, assigneeId: string, userId: string, userRole: UserRole, userTeamId: string | null) {
  if (userRole === UserRole.Requester) throw new ForbiddenError("Only agents and admins can assign tickets");
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, teamId: true, assigneeId: true } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  if (userRole === UserRole.Agent && (!userTeamId || ticket.teamId !== userTeamId)) throw new ForbiddenError("You can only assign tickets in your team");
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true, teamId: true, role: true } });
  if (!assignee) throw new NotFoundError("Assignee user not found");
  if (userRole === UserRole.Agent && assignee.teamId !== userTeamId) throw new ForbiddenError("Assignee must be in the same team");
  const [updated] = await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId }, include: { priority: true, category: true, requester: { select: { id: true, name: true, email: true } }, team: true, assignee: { select: { id: true, name: true, email: true } } } }),
    prisma.auditLog.create({ data: { ticketId, changedByUserId: userId, field: "assignee", oldValue: ticket.assigneeId || "unassigned", newValue: assigneeId } }),
  ]);
  return {
    ...updated,
    isOverdue: updated.dueAt ? updated.dueAt.getTime() < Date.now() : false,
  };
}

export async function addComment(ticketId: string, body: string, isInternal: boolean, userId: string, userRole: UserRole, userTeamId: string | null) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, requesterId: true, teamId: true } });
  if (!ticket) throw new NotFoundError("Ticket not found");
  if (userRole === UserRole.Requester) { if (ticket.requesterId !== userId) throw new ForbiddenError("You can only comment on your own tickets"); if (isInternal) throw new ForbiddenError("Requesters cannot post internal comments"); }
  if (userRole === UserRole.Agent && (!userTeamId || ticket.teamId !== userTeamId)) throw new ForbiddenError("You can only comment on tickets in your team");
  return await prisma.comment.create({ data: { body, isInternal, ticketId, userId }, include: { user: { select: { id: true, name: true, role: true } } } });
}