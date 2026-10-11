// Admin controller: thin route handlers that call the admin service.

import { Request, Response, NextFunction } from "express";
import * as s from "../services/admin.service";

function pid(req: Request): string { return req.params.id as string; }

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try { const u = await s.createUser({ ...req.body, adminId: req.user!.id }); res.status(201).json(u); } catch (e) { next(e); }
}
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try { const r = await s.listUsers(req.query as any); res.json(r); } catch (e) { next(e); }
}
export async function getUser(req: Request, res: Response, next: NextFunction) {
  try { const u = await s.getUserById(pid(req)); res.json(u); } catch (e) { next(e); }
}
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try { const u = await s.updateUser(pid(req), req.body, req.user!.id); res.json(u); } catch (e) { next(e); }
}
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try { await s.resetPassword(pid(req), req.body.newPassword, req.user!.id); res.json({ message: "Password reset" }); } catch (e) { next(e); }
}

export async function createTeam(req: Request, res: Response, next: NextFunction) {
  try { const t = await s.createTeam(req.body, req.user!.id); res.status(201).json(t); } catch (e) { next(e); }
}
export async function listTeams(req: Request, res: Response, next: NextFunction) {
  try { const ts = await s.listTeams(); res.json(ts); } catch (e) { next(e); }
}
export async function getTeam(req: Request, res: Response, next: NextFunction) {
  try { const t = await s.getTeamById(pid(req)); res.json(t); } catch (e) { next(e); }
}
export async function updateTeam(req: Request, res: Response, next: NextFunction) {
  try { const t = await s.updateTeam(pid(req), req.body, req.user!.id); res.json(t); } catch (e) { next(e); }
}
export async function deleteTeam(req: Request, res: Response, next: NextFunction) {
  try { await s.deleteTeam(pid(req), req.user!.id); res.json({ message: "Team deleted" }); } catch (e) { next(e); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try { const c = await s.createCategory(req.body, req.user!.id); res.status(201).json(c); } catch (e) { next(e); }
}
export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try { const cs = await s.listCategories(); res.json(cs); } catch (e) { next(e); }
}
export async function getCategory(req: Request, res: Response, next: NextFunction) {
  try { const c = await s.getCategoryById(pid(req)); res.json(c); } catch (e) { next(e); }
}
export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try { const c = await s.updateCategory(pid(req), req.body, req.user!.id); res.json(c); } catch (e) { next(e); }
}
export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try { await s.deleteCategory(pid(req), req.user!.id); res.json({ message: "Category deleted" }); } catch (e) { next(e); }
}

export async function createPriority(req: Request, res: Response, next: NextFunction) {
  try { const p = await s.createPriority(req.body, req.user!.id); res.status(201).json(p); } catch (e) { next(e); }
}
export async function listPriorities(req: Request, res: Response, next: NextFunction) {
  try { const ps = await s.listPriorities(); res.json(ps); } catch (e) { next(e); }
}
export async function getPriority(req: Request, res: Response, next: NextFunction) {
  try { const p = await s.getPriorityById(pid(req)); res.json(p); } catch (e) { next(e); }
}
export async function updatePriority(req: Request, res: Response, next: NextFunction) {
  try { const p = await s.updatePriority(pid(req), req.body, req.user!.id); res.json(p); } catch (e) { next(e); }
}
export async function deletePriority(req: Request, res: Response, next: NextFunction) {
  try { await s.deletePriority(pid(req), req.user!.id); res.json({ message: "Priority deleted" }); } catch (e) { next(e); }
}

export async function createSLA(req: Request, res: Response, next: NextFunction) {
  try { const sl = await s.createSLA(req.body, req.user!.id); res.status(201).json(sl); } catch (e) { next(e); }
}
export async function listSLAs(req: Request, res: Response, next: NextFunction) {
  try { const sls = await s.listSLAs(); res.json(sls); } catch (e) { next(e); }
}
export async function getSLA(req: Request, res: Response, next: NextFunction) {
  try { const sl = await s.getSLAById(pid(req)); res.json(sl); } catch (e) { next(e); }
}
export async function updateSLA(req: Request, res: Response, next: NextFunction) {
  try { const sl = await s.updateSLA(pid(req), req.body, req.user!.id); res.json(sl); } catch (e) { next(e); }
}
export async function deleteSLA(req: Request, res: Response, next: NextFunction) {
  try { await s.deleteSLA(pid(req), req.user!.id); res.json({ message: "SLA deleted" }); } catch (e) { next(e); }
}
