// Zod schemas for validating ticket-related request bodies.
// Every incoming request that creates or modifies a ticket goes through
// these schemas before the service layer touches the data.

import { z } from "zod";
import { TicketStatus } from "@prisma/client";

// Create ticket: title, description, priority, and category are required
export const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  description: z.string().min(1, "Description is required"),
  priorityId: z.string().min(1, "Priority is required"),
  categoryId: z.string().min(1, "Category is required"),
  teamId: z.string().optional(),
  onBehalfOfUserId: z.string().optional(),
});

// Status transition: must include a valid TicketStatus, plus optional priority/category/team changes.
export const transitionStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus, {
    message: "Invalid status value",
  }),
  priorityId: z.string().optional(),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
});

// Assign ticket: just the user ID to assign to
export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1, "Assignee user ID is required"),
});

// Add comment: body text and whether it's internal
export const addCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
  isInternal: z.boolean().default(false),
});

export type CreateTicketInput2 = z.infer<typeof createTicketSchema>;
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
// ─── ATTACHMENT VALIDATION ───────────────────────────────────────────
// Validates the filename and mime type from multipart upload metadata.
export const uploadAttachmentSchema = z.object({
  // fileName: max 255 chars, only safe characters (no path traversal).
  fileName: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._\-\s()]+$/, {
    message: "Filename contains invalid characters",
  }),
  // mimeType: standard media type like "image/png" or "application/pdf".
  mimeType: z.string().min(1).max(100).regex(/^[a-zA-Z0-9.\-+/]+$/, {
    message: "Invalid mime type format",
  }),
});