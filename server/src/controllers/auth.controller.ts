// This file handles authentication HTTP requests.
// It's the "thin layer" between the route definitions and the service logic.
// Controllers should be simple: parse the request, call the service, send the response.

import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";

// POST /api/auth/register
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body;
    const user = await authService.registerUser(email, password, name);
    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/refresh
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    await authService.logoutUser(refreshToken);
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/me — returns the current user (requires auth middleware)
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: req.user });
  } catch (error) {
    next(error);
  }
}