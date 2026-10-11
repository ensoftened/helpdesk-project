// Attachment controller: handles HTTP requests for file uploads, listing, and downloads.
// Each function extracts data from the request, calls the service layer,
// and sends the appropriate HTTP response.
//
// NEW CONCEPT for download: we set Content-Disposition header to tell the browser
// to download the file rather than display it inline. We also set Content-Type
// to the file's MIME type so the browser knows what kind of file it is.

import { Request, Response, NextFunction } from "express";
import * as attachmentService from "../services/attachment.service";

// Helper: extract the ticketId from the URL parameter (cast to string).
function ticketId(req: Request): string { return req.params.ticketId as string; }
// Helper: extract the attachmentId from the URL parameter (cast to string).
function attachmentId(req: Request): string { return req.params.attachmentId as string; }

// POST /api/tickets/:ticketId/attachments — upload a file.
// Expects a multipart body with 'file' (the binary) and fields for fileName and mimeType.
export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    // req.file is set by multer (the multipart middleware) — contains the buffer.
    if (!req.file) {
      res.status(400).json({ error: { code: "NO_FILE", message: "No file provided" } });
      return;
    }
    // req.body.fileName and req.body.mimeType come from the form fields.
    const attachment = await attachmentService.uploadAttachment(
      {
        ticketId: ticketId(req),
        fileName: req.body.fileName,
        mimeType: req.body.mimeType,
        buffer: req.file.buffer,
      },
      req.user!.id,
      req.user!.role,
      req.user!.teamId
    );
    res.status(201).json({ data: attachment });
  } catch (error) { next(error); }
}

// GET /api/tickets/:ticketId/attachments — list all attachments for a ticket.
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const attachments = await attachmentService.listAttachments(
      ticketId(req), req.user!.role, req.user!.id, req.user!.teamId
    );
    res.json({ data: attachments });
  } catch (error) { next(error); }
}

// GET /api/tickets/:ticketId/attachments/:attachmentId — download a single file.
export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await attachmentService.downloadAttachment(
      attachmentId(req), req.user!.role, req.user!.id, req.user!.teamId
    );
    // Tell the browser to download (not display) the file.
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    // Tell the browser what kind of content this is.
    res.setHeader("Content-Type", file.mimeType);
    // Send the raw bytes as the response body.
    res.send(file.data);
  } catch (error) { next(error); }
}