// Admin service: CRUD for users, teams, categories, priorities, SLA rules.
// Every mutation logs an audit entry so we know who did what.

import * as bcrypt from "bcrypt";
import prisma from "../config/prisma";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";

// --- AUDIT LOG HELPER ------------------------------------------------
async function log(m: { changedByUserId: string; field: string; oldValue?: string | null; newValue: string; ticketId?: string }) {
  await prisma.auditLog.create({
    data: {
      changedByUserId: m.changedByUserId,
      field: m.field,
      oldValue: m.oldValue ?? null,
      newValue: m.newValue,
      ticketId: m.ticketId ?? null,
    },
  });
}

// --- USERS -----------------------------------------------------------
export async function createUser(data: { email: string; password: string; name: string; role: string; teamId?: string; adminId: string }) {
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new ConflictError("Email already registered");
  if (data.role === "Agent" && !data.teamId) throw new ValidationError("Agent must have a team");
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { email: data.email, passwordHash, name: data.name, role: data.role as any, teamId: data.teamId ?? null, isActive: true },
    select: { id: true, email: true, name: true, role: true, teamId: true, isActive: true, createdAt: true },
  });
  await log({ changedByUserId: data.adminId, field: "user_created", newValue: `Created user ${data.email} with role ${data.role}` });
  return user;
}

export async function listUsers(filters?: { role?: string; isActive?: boolean }) {
  const where: any = {};
  if (filters?.role) where.role = filters.role;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  const data = await prisma.user.findMany({
    where, orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, teamId: true, isActive: true, createdAt: true },
  });
  return { data };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true, teamId: true, isActive: true, createdAt: true } });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function updateUser(id: string, data: { email?: string; name?: string; role?: string; teamId?: string | null; isActive?: boolean }, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");
  if (data.email && data.email !== user.email) {
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ConflictError("Email already in use");
  }
  if (data.role === "Agent" && data.teamId === undefined && !user.teamId) throw new ValidationError("Agent must have a team");

  const updateData: any = {};
  const audits: Array<{ field: string; old: string; new: string }> = [];

  if (data.email !== undefined && data.email !== user.email) { updateData.email = data.email; audits.push({ field: "email", old: user.email, new: data.email }); }
  if (data.name !== undefined && data.name !== user.name) { updateData.name = data.name; audits.push({ field: "name", old: user.name, new: data.name }); }
  if (data.role !== undefined && data.role !== user.role) { updateData.role = data.role as any; audits.push({ field: "role", old: user.role, new: data.role }); }
  if (data.teamId !== undefined && data.teamId !== user.teamId) { updateData.teamId = data.teamId; audits.push({ field: "teamId", old: user.teamId ?? "none", new: data.teamId ?? "none" }); }
  if (data.isActive !== undefined && data.isActive !== user.isActive) {
    updateData.isActive = data.isActive;
    audits.push({ field: "isActive", old: String(user.isActive), new: String(data.isActive) });
    if (!data.isActive) {
      // Revoke all refresh tokens on deactivation
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
    }
  }

  const updated = await prisma.user.update({ where: { id }, data: updateData, select: { id: true, email: true, name: true, role: true, teamId: true, isActive: true, createdAt: true } });
  for (const a of audits) await log({ changedByUserId: adminId, field: a.field, oldValue: a.old, newValue: a.new });
  return updated;
}

export async function resetPassword(id: string, newPassword: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  // Revoke all tokens so old sessions die
  await prisma.refreshToken.deleteMany({ where: { userId: id } });
  await log({ changedByUserId: adminId, field: "password_reset", newValue: `Password reset for ${user.email}` });
}

// --- TEAMS ------------------------------------------------------------
export async function createTeam(data: { name: string; description?: string }, adminId: string) {
  const exists = await prisma.team.findUnique({ where: { name: data.name } });
  if (exists) throw new ConflictError("Team name already exists");
  const team = await prisma.team.create({ data: { name: data.name, description: data.description ?? "" } });
  await log({ changedByUserId: adminId, field: "team_created", newValue: `Created team ${data.name}` });
  return team;
}

export async function listTeams() {
  return await prisma.team.findMany({ include: { _count: { select: { users: true } } } });
}

export async function getTeamById(id: string) {
  const team = await prisma.team.findUnique({ where: { id }, include: { users: { select: { id: true, name: true, email: true } }, _count: { select: { users: true, tickets: true } } } });
  if (!team) throw new NotFoundError("Team not found");
  return team;
}

export async function updateTeam(id: string, data: { name?: string; description?: string }, adminId: string) {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw new NotFoundError("Team not found");
  if (data.name && data.name !== team.name) {
    const exists = await prisma.team.findUnique({ where: { name: data.name } });
    if (exists) throw new ConflictError("Team name already exists");
  }
  const updated = await prisma.team.update({ where: { id }, data });
  await log({ changedByUserId: adminId, field: "team_updated", oldValue: team.name, newValue: updated.name });
  return updated;
}

export async function deleteTeam(id: string, adminId: string) {
  const team = await prisma.team.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!team) throw new NotFoundError("Team not found");
  if (team._count.users > 0) throw new ConflictError("Cannot delete team with agents still assigned");
  await prisma.team.delete({ where: { id } });
  await log({ changedByUserId: adminId, field: "team_deleted", oldValue: team.name, newValue: "deleted" });
}

// --- CATEGORIES -------------------------------------------------------
export async function createCategory(data: { name: string; description?: string; defaultTeamId?: string | null }, adminId: string) {
  const exists = await prisma.category.findUnique({ where: { name: data.name } });
  if (exists) throw new ConflictError("Category name already exists");
  const category = await prisma.category.create({ data: { name: data.name, description: data.description ?? "", defaultTeamId: data.defaultTeamId ?? null } });
  await log({ changedByUserId: adminId, field: "category_created", newValue: `Created category ${data.name}` });
  return category;
}

export async function listCategories() {
  return await prisma.category.findMany({ include: { defaultTeam: { select: { id: true, name: true } }, _count: { select: { tickets: true } } } });
}

export async function getCategoryById(id: string) {
  const cat = await prisma.category.findUnique({ where: { id }, include: { defaultTeam: true } });
  if (!cat) throw new NotFoundError("Category not found");
  return cat;
}

export async function updateCategory(id: string, data: { name?: string; description?: string; defaultTeamId?: string | null }, adminId: string) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new NotFoundError("Category not found");
  if (data.name && data.name !== cat.name) {
    const exists = await prisma.category.findUnique({ where: { name: data.name } });
    if (exists) throw new ConflictError("Category name already exists");
  }
  const updated = await prisma.category.update({ where: { id }, data });
  await log({ changedByUserId: adminId, field: "category_updated", oldValue: cat.name, newValue: updated.name });
  return updated;
}

export async function deleteCategory(id: string, adminId: string) {
  const cat = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { tickets: true } } } });
  if (!cat) throw new NotFoundError("Category not found");
  if (cat._count.tickets > 0) throw new ConflictError("Cannot delete category with tickets assigned");
  await prisma.category.delete({ where: { id } });
  await log({ changedByUserId: adminId, field: "category_deleted", oldValue: cat.name, newValue: "deleted" });
}

// --- PRIORITIES -------------------------------------------------------
export async function createPriority(data: { name: string; level: number }, adminId: string) {
  const exists = await prisma.priority.findFirst({ where: { OR: [{ name: data.name }, { level: data.level }] } });
  if (exists) throw new ConflictError("Priority name or level already exists");
  const priority = await prisma.priority.create({ data });
  await log({ changedByUserId: adminId, field: "priority_created", newValue: `Created priority ${data.name}` });
  return priority;
}

export async function listPriorities() {
  return await prisma.priority.findMany({ orderBy: { level: "asc" }, include: { _count: { select: { tickets: true } } } });
}

export async function getPriorityById(id: string) {
  const p = await prisma.priority.findUnique({ where: { id } });
  if (!p) throw new NotFoundError("Priority not found");
  return p;
}

export async function updatePriority(id: string, data: { name?: string; level?: number }, adminId: string) {
  const p = await prisma.priority.findUnique({ where: { id } });
  if (!p) throw new NotFoundError("Priority not found");
  if ((data.name && data.name !== p.name) || (data.level && data.level !== p.level)) {
    const exists = await prisma.priority.findFirst({
      where: { OR: [{ name: data.name }, { level: data.level }].filter(Boolean), NOT: { id } },
    });
    if (exists) throw new ConflictError("Priority name or level already exists");
  }
  const updated = await prisma.priority.update({ where: { id }, data });
  await log({ changedByUserId: adminId, field: "priority_updated", oldValue: p.name, newValue: updated.name });
  return updated;
}

export async function deletePriority(id: string, adminId: string) {
  const p = await prisma.priority.findUnique({ where: { id }, include: { _count: { select: { tickets: true } } } });
  if (!p) throw new NotFoundError("Priority not found");
  if (p._count.tickets > 0) throw new ConflictError("Cannot delete priority with tickets assigned");
  await prisma.priority.delete({ where: { id } });
  await log({ changedByUserId: adminId, field: "priority_deleted", oldValue: p.name, newValue: "deleted" });
}

// --- SLA --------------------------------------------------------------
export async function createSLA(data: { categoryId?: string | null; priorityId: string; responseHours: number; resolutionHours: number }, adminId: string) {
  const exists = await prisma.sLA.findFirst({ where: { categoryId: data.categoryId ?? null, priorityId: data.priorityId } });
  if (exists) throw new ConflictError("SLA rule already exists for this category+priority combo");
  const sla = await prisma.sLA.create({ data: { categoryId: data.categoryId ?? null, priorityId: data.priorityId, responseHours: data.responseHours, resolutionHours: data.resolutionHours } });
  await log({ changedByUserId: adminId, field: "sla_created", newValue: `Created SLA rule` });
  return sla;
}

export async function listSLAs() {
  return await prisma.sLA.findMany({ include: { category: true, priority: true } });
}

export async function getSLAById(id: string) {
  const sla = await prisma.sLA.findUnique({ where: { id }, include: { category: true, priority: true } });
  if (!sla) throw new NotFoundError("SLA rule not found");
  return sla;
}

export async function updateSLA(id: string, data: { categoryId?: string | null; priorityId?: string; responseHours?: number; resolutionHours?: number }, adminId: string) {
  const sla = await prisma.sLA.findUnique({ where: { id } });
  if (!sla) throw new NotFoundError("SLA rule not found");
  const updated = await prisma.sLA.update({ where: { id }, data });
  await log({ changedByUserId: adminId, field: "sla_updated", oldValue: `SLA ${sla.id}`, newValue: "updated" });
  return updated;
}

export async function deleteSLA(id: string, adminId: string) {
  const sla = await prisma.sLA.findUnique({ where: { id } });
  if (!sla) throw new NotFoundError("SLA rule not found");
  await prisma.sLA.delete({ where: { id } });
  await log({ changedByUserId: adminId, field: "sla_deleted", oldValue: `SLA ${sla.id}`, newValue: "deleted" });
}
