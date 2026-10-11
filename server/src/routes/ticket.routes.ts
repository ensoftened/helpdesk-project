// Routes for everything ticket-related.
// These routes all require authentication. The ticket-specific access
// check (requireTicketAccess) is applied to routes that touch a single ticket.

import { Router } from "express";
import { authenticate, requireRole, requireTicketAccess } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createTicketSchema, transitionStatusSchema,
  assignTicketSchema, addCommentSchema,
} from "../validators/ticket.validator";
import * as ticketController from "../controllers/ticket.controller";
// Multer: middleware that parses multipart/form-data requests (file uploads).
// We use memoryStorage() so the file bytes stay in RAM as a Buffer instead of
// being written to disk. This fits our BLOB storage approach.
import multer from "multer";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max, matches our service limit
});

import { UserRole } from "@prisma/client";
import * as attachmentController from "../controllers/attachment.controller";

const router = Router();

// All routes require authentication — applied at the router level
router.use(authenticate);

// POST /api/tickets — create a new ticket
// Anyone can create (Requester, Agent, Admin)
router.post("/", validate(createTicketSchema), ticketController.create);

// GET /api/tickets — list tickets (scoped by role)
router.get("/", ticketController.list);

// GET /api/tickets/:ticketId — get one ticket
router.get("/:ticketId", requireTicketAccess, ticketController.getOne);

// PATCH /api/tickets/:ticketId/status — change status
router.patch(
  "/:ticketId/status",
  requireTicketAccess,
  validate(transitionStatusSchema),
  ticketController.transition
);

// PATCH /api/tickets/:ticketId/assign — assign to a user
// Only Agents and Admins can assign
router.patch(
  "/:ticketId/assign",
  requireTicketAccess,
  requireRole(UserRole.Agent, UserRole.Admin),
  validate(assignTicketSchema),
  ticketController.assign
);

// POST /api/tickets/:ticketId/comments — add a comment
router.post(
  "/:ticketId/comments",
  requireTicketAccess,
  validate(addCommentSchema),
  ticketController.addComment
);

// POST /api/tickets/:ticketId/attachments — upload a file
// Uses multer to handle the multipart form data with a single file field named 'file'.
router.post(
  "/:ticketId/attachments",
  requireTicketAccess,
  upload.single("file"), // 'file' is the form field name for the binary data
  attachmentController.upload
);

// GET /api/tickets/:ticketId/attachments — list all attachments for a ticket
router.get(
  "/:ticketId/attachments",
  requireTicketAccess,
  attachmentController.list
);

// GET /api/tickets/:ticketId/attachments/:attachmentId — download one file
router.get(
  "/:ticketId/attachments/:attachmentId",
  requireTicketAccess,
  attachmentController.download
);

export default router;