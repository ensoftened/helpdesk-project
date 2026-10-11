// A generic middleware that validates request bodies using a Zod schema.
// Instead of writing validation logic for every endpoint, we just call
// this with the schema, and it handles the rest.
// Think of it like a shape checker: you give it the blueprint (schema),
// and it rejects any request that doesn't match.

import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Parse the request body against the Zod schema
    const result = schema.safeParse(req.body);

    // If parsing fails (data doesn't match the schema)
    if (!result.success) {
      // Extract human-readable error messages from Zod
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      // Pass a validation error to the error handler
      next(new ValidationError(messages.join("; ")));
      return;
    }

    // Replace req.body with the parsed (cleaned and typed) data
    // This strips out any extra fields and fills defaults
    req.body = result.data;
    next();
  };
}