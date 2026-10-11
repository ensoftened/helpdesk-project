// Authorization middleware: role-based access checks.
// "Authorization" = "are you allowed to do this?", as opposed to
// "Authentication" = "do I know who you are?".

import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import { UserRole } from "@prisma/client";

// requireAdmin: allows only Admin users through.
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) { next(new UnauthorizedError("Authentication required")); return; }
  if (req.user.role !== UserRole.Admin) {
    next(new ForbiddenError("Only administrators can access this resource"));
    return;
  }
  next();
}
