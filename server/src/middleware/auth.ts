// This file exports middleware functions for authentication and authorization.
// "Middleware" means a function that runs before the route handler.
// Think of it like a security checkpoint at an airport:
// 1. authenticate = check your passport (are you who you say you are?)
// 2. requireRole = check your ticket class (are you allowed in first class?)
// NEW CONCEPT: JWT (JSON Web Token) is a signed token sent as a header.

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";
import { UserRole } from "@prisma/client";
import prisma from "../config/prisma";

// Extend Express Request type to include our authenticated user.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        name: string;
        teamId: string | null;
        isActive: boolean;
      };
    }
  }
}

// authenticate: verifies the JWT access token and loads the user from DB.
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedError("No token provided");
    }
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new UnauthorizedError("Invalid token format");
    }
    const token = parts[1];
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as { userId: string; role: UserRole };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, name: true, teamId: true, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }
    if (!user.isActive) {
      throw new ForbiddenError("Account is deactivated");
    }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) { next(error); return; }
    if (error instanceof jwt.JsonWebTokenError) { next(new UnauthorizedError("Invalid or expired token")); return; }
    next(error);
  }
}

// requireRole: checks that the user has one of the allowed roles.
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) { next(new UnauthorizedError("Authentication required")); return; }
    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError(`Role '${req.user.role}' is not allowed`));
      return;
    }
    next();
  };
}

// requireTicketAccess: scope check for tickets.
// Requester = own tickets only. Agent = team tickets only. Admin = any.
export async function requireTicketAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { next(new UnauthorizedError("Authentication required")); return; }
  if (req.user.role === UserRole.Admin) { next(); return; }
  const ticketId = req.params.ticketId as string;
  if (!ticketId) { next(new ForbiddenError("No ticket ID")); return; }
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requesterId: true, teamId: true },
  });
  if (!ticket) { next(new ForbiddenError("Ticket not found")); return; }
  if (req.user.role === UserRole.Requester && ticket.requesterId !== req.user.id) {
    next(new ForbiddenError("You can only access your own tickets"));
    return;
  }
  if (req.user.role === UserRole.Agent && (!req.user.teamId || ticket.teamId !== req.user.teamId)) {
    next(new ForbiddenError("You can only access tickets in your team"));
    return;
  }
  next();
}