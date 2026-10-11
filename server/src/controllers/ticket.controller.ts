// Handles HTTP requests for tickets — tickets, comments, assignments, status transitions.
// Every endpoint reads request data from req.body or req.params,
// calls the ticket service, and returns a JSON response.

import { Request, Response, NextFunction } from "express";
import * as ticketService from "../services/ticket.service";

// Helper: safely extract ticketId from params (Express 5 types it as string | string[])
function ticketId(req: Request): string {
  return req.params.ticketId as string;
}

// POST /api/tickets
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.createTicket(
      req.body, req.user!.id, req.user!.role, req.user!.teamId, req.body.onBehalfOfUserId
    );
    res.status(201).json({ data: ticket });
  } catch (error) { next(error); }
}

// GET /api/tickets — list tickets with optional filters, pagination, sort, and search
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract query string parameters. All are optional; defaults are handled in the service.
    const filters = {
      status: req.query.status as any,
      priorityId: req.query.priorityId as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
    };
    const result = await ticketService.listTickets(
      req.user!.id, req.user!.role, req.user!.teamId, filters
    );
    // result is { data: [...], pagination: { page, limit, total, totalPages } }
    res.json(result);
  } catch (error) { next(error); }
}

// GET /api/tickets/:ticketId
export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.getTicket(ticketId(req), req.user!.role);
    res.json({ data: ticket });
  } catch (error) { next(error); }
}

// PATCH /api/tickets/:ticketId/status — change status + optionally priority/category/team
export async function transition(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract optional priority/category/team changes from the request body.
    const ticket = await ticketService.transitionStatus(
      ticketId(req), req.body.status, req.user!.id, req.user!.role, req.user!.teamId,
      { priorityId: req.body.priorityId, categoryId: req.body.categoryId, teamId: req.body.teamId }
    );
    res.json({ data: ticket });
  } catch (error) { next(error); }
}

// PATCH /api/tickets/:ticketId/assign
export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.assignTicket(
      ticketId(req), req.body.assigneeId, req.user!.id, req.user!.role, req.user!.teamId
    );
    res.json({ data: ticket });
  } catch (error) { next(error); }
}

// POST /api/tickets/:ticketId/comments
export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    const comment = await ticketService.addComment(
      ticketId(req), req.body.body, req.body.isInternal ?? false,
      req.user!.id, req.user!.role, req.user!.teamId
    );
    res.status(201).json({ data: comment });
  } catch (error) { next(error); }
}