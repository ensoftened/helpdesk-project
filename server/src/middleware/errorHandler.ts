// This middleware catches all errors thrown in route handlers and
// formats them into a consistent JSON response.
// Think of it like a safety net: if any handler throws an error,
// this catches it and sends a clean response instead of crashing.

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import multer from "multer";

export function errorHandler(
  err: Error,            // The error that was thrown
  req: Request,          // The incoming HTTP request
  res: Response,         // The outgoing HTTP response we'll send
  _next: NextFunction    // Unused but required by Express signature
) {
  // If it's one of our custom AppError types, use its status code and code
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,         // Machine-readable code like "NOT_FOUND"
        message: err.message,   // Human-readable explanation
      },
    });
    return;
  }

  // Handle Multer errors (file upload middleware) as 400 errors.
  if (err instanceof multer.MulterError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,   // e.g. "File too large"
      },
    });
    return;
  }

  // Log unexpected errors to the console for debugging
  console.error("Unexpected error:", err);

  // For any error we didn't expect, return a generic 500 response.
  // In production, we don't expose the raw error message to avoid leaking info.
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    },
  });
}