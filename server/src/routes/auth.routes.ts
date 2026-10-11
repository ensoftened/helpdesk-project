// Defines the URL endpoints for authentication.
// Each route connects an HTTP method + path to a controller function,
// with validation middleware in between.
// Think of it like a restaurant menu: each entry is "what you can order"
// (the endpoint) mapped to "who will make it" (the controller).

import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  registerSchema, loginSchema, refreshSchema, logoutSchema,
} from "../validators/auth.validator";
import * as authController from "../controllers/auth.controller";

const router = Router();

// POST /api/auth/register — create a new account
router.post("/register", validate(registerSchema), authController.register);

// POST /api/auth/login — get access + refresh tokens
router.post("/login", validate(loginSchema), authController.login);

// POST /api/auth/refresh — get a new access token
router.post("/refresh", validate(refreshSchema), authController.refresh);

// POST /api/auth/logout — revoke a refresh token
router.post("/logout", validate(logoutSchema), authController.logout);

// GET /api/auth/me — get current user info (requires authentication)
router.get("/me", authenticate, authController.me);

export default router;