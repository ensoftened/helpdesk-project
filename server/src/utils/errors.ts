// This file defines custom error classes for our application.
// Using custom errors lets us attach an error code and HTTP status
// to each error, so the error handler middleware can format them
// consistently for every endpoint response.

// AppError is the base class. All our specific errors extend it.
// "extends Error" means it inherits all the built-in Error behavior,
// and we add extra properties like statusCode and code.
export class AppError extends Error {
  // The HTTP status code (e.g., 400, 401, 403, 404, 500)
  statusCode: number;
  // A short machine-readable code like "VALIDATION_ERROR"
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message); // Call the parent Error constructor with the message
    this.statusCode = statusCode;
    this.code = code;
    // Capture the stack trace (where the error was created) for debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

// NotFoundError: use when a resource (ticket, user, etc.) doesn't exist
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

// ValidationError: use when the user sends bad data (caught by Zod or manual checks)
export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

// UnauthorizedError: use when the user isn't logged in (no valid token)
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

// ForbiddenError: use when the user is logged in but doesn't have permission
export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

// ConflictError: use for duplicate entries (e.g., email already exists)
export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}