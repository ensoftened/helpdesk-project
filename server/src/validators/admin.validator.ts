// Zod schemas for admin endpoints: users, teams, categories, priorities, SLA rules.

import { z } from "zod";

// --- User -----------------------------------------------------------
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  role: z.enum(["Requester", "Agent", "Admin"]),
  teamId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
  role: z.enum(["Requester", "Agent", "Admin"]).optional(),
  teamId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

// --- Team ------------------------------------------------------------
export const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

// --- Category --------------------------------------------------------
export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  defaultTeamId: z.string().uuid().nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  defaultTeamId: z.string().uuid().nullable().optional(),
});

// --- Priority --------------------------------------------------------
export const createPrioritySchema = z.object({
  name: z.string().min(1).max(255),
  level: z.number().int().min(0),
});

export const updatePrioritySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  level: z.number().int().min(0).optional(),
});

// --- SLA -------------------------------------------------------------
export const createSLASchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  priorityId: z.string().uuid(),
  responseHours: z.number().int().min(0),
  resolutionHours: z.number().int().min(0),
});

export const updateSLASchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  priorityId: z.string().uuid().optional(),
  responseHours: z.number().int().min(0).optional(),
  resolutionHours: z.number().int().min(0).optional(),
});
