// Dashboard controller: aggregates system-wide stats for the admin dashboard.

import { Request, Response, NextFunction } from "express";
import { getDashboardStats } from "../services/dashboard.service";

export async function dashboard(req: Request, res: Response, next: NextFunction) {
  try { const stats = await getDashboardStats(); res.json(stats); } catch (e) { next(e); }
}
