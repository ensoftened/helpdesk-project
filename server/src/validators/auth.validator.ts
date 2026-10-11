// This file defines Zod schemas for validating input on auth endpoints.
// Zod is a validation library: you describe the shape you expect data to
// have, and Zod checks incoming requests against that shape.
// Think of it like a bouncer at a club checking IDs — if you don't match
// the requirements, you don't get in.
// NEW CONCEPT: Zod schemas produce the TypeScript type automatically
// when you use z.infer<typeof schema>.

import { z } from "zod";

// Register schema: email must look like an email, password must be at least 6 chars
export const registerSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

// Login schema: same fields but name is not needed
export const loginSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Refresh token schema: just needs the refresh token string
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Logout schema: same — just the token to revoke
export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Export the TypeScript types that Zod infers from these schemas
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;