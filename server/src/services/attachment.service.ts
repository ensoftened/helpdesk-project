// Attachment business logic: upload, list, and download files attached to a ticket.
//
// NEW CONCEPT: BLOB (Binary Large OBject) — storing file data directly in the database
// as raw bytes. Each attachment is a row with the file name, MIME type, size, and
// the actual file bytes in the 'data' column. This avoids needing a separate file server.
//
// How it fits: this file is called by attachment routes/controllers. It talks to
// Prisma to store and retrieve file data from the database.

import prisma from "../config/prisma";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors";
import { UserRole } from "@prisma/client";

// Maximum file size: 10 MB (10485760 bytes). Prevents abuse of database storage.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Input: the raw file buffer (byte array) and metadata fields.
export interface UploadAttachmentInput {
  ticketId: string;     // Which ticket this file belongs to
  fileName: string;     // Original filename from the client
  mimeType: string;     // MIME type like "image/png"
  buffer: Buffer;       // The actual file bytes
}

// Output: what we return after upload (no data field — we download separately).
export interface AttachmentOutput {
  id: string;
  ticketId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

// uploadAttachment: stores a file attached to a ticket.
// Requesters can upload to their own tickets; agents/admins can upload to any.
export async function uploadAttachment(
  input: UploadAttachmentInput,
  userId: string,
  userRole: UserRole,
  userTeamId: string | null
): Promise<AttachmentOutput> {
  // Step 1: check file size — reject anything over 10 MB.
  if (input.buffer.length > MAX_FILE_SIZE) {
    throw new ValidationError("File size exceeds the 10 MB limit");
  }
  // Step 2: verify the ticket exists and user has access to it.
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, requesterId: true, teamId: true },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");
  // Requesters can only upload to their own tickets.
  if (userRole === UserRole.Requester && ticket.requesterId !== userId) {
    throw new ForbiddenError("You can only upload files to your own tickets");
  }
  // Agents can only upload to their team's tickets.
  if (userRole === UserRole.Agent && (!userTeamId || ticket.teamId !== userTeamId)) {
    throw new ForbiddenError("You can only upload files to tickets in your team");
  }
  // Step 3: insert the attachment row.
  const attachment = await prisma.attachment.create({
    data: {
      ticketId: input.ticketId,
      userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      data: new Uint8Array(input.buffer), // Cast Buffer to Uint8Array for Prisma
    },
    select: {
      id: true,
      ticketId: true,
      userId: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  return attachment;
}

// listAttachments: returns all attachment metadata for a ticket (no file data).
// Requesters can see their own ticket's attachments; agents can see team tickets';
// admins can see all.
export async function listAttachments(
  ticketId: string,
  userRole: UserRole,
  userId: string,
  userTeamId: string | null
): Promise<AttachmentOutput[]> {
  // Verify ticket access.
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requesterId: true, teamId: true },
  });
  if (!ticket) throw new NotFoundError("Ticket not found");
  if (userRole === UserRole.Requester && ticket.requesterId !== userId) {
    throw new ForbiddenError("Access denied");
  }
  if (userRole === UserRole.Agent && (!userTeamId || ticket.teamId !== userTeamId)) {
    throw new ForbiddenError("Access denied");
  }
  // Return all attachments for this ticket (newest first).
  return await prisma.attachment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, ticketId: true, userId: true,
      fileName: true, mimeType: true, sizeBytes: true, createdAt: true,
    },
  });
}

// downloadAttachment: returns one attachment including its file data (the BLOB).
export async function downloadAttachment(
  attachmentId: string,
  userRole: UserRole,
  userId: string,
  userTeamId: string | null
): Promise<{ fileName: string; mimeType: string; data: Uint8Array | Buffer }> {
  // Find the attachment, including the ticket it belongs to for access checking.
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      ticket: { select: { requesterId: true, teamId: true } },
    },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");
  // Access check against the parent ticket.
  if (userRole === UserRole.Requester && attachment.ticket.requesterId !== userId) {
    throw new ForbiddenError("Access denied");
  }
  if (userRole === UserRole.Agent && (!userTeamId || attachment.ticket.teamId !== userTeamId)) {
    throw new ForbiddenError("Access denied");
  }
  // Return the file metadata and raw bytes.
  return {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    data: attachment.data,
  };
}