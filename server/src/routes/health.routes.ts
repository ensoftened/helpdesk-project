// The health check route. Used to verify the server is running.
// Monitoring tools and Docker often ping /health to check if the app is alive.

import { Router, Request, Response } from "express";

const router = Router();

// GET /health — returns a simple OK response
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(), // Current time for debugging
  });
});

export default router;