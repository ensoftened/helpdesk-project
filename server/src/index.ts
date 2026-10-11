// This is the main entry point of the backend server.
// It starts Express, connects middleware, registers routes, and begins listening.
// Think of it like turning on the engine of a car — everything starts from here.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import ticketRoutes from "./routes/ticket.routes";
import adminRoutes from "./routes/admin.routes";
import dashboardRoutes from "./routes/dashboard.routes";

// Create the Express application — our "web server" object
const app = express();

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────────
// Helmet: adds security-related HTTP headers
app.use(helmet());
// CORS: allows the frontend (on a different port) to call the API
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
// Express JSON parser: automatically parses JSON request bodies
app.use(express.json());

// ─── ROUTES ─────────────────────────────────────────────────────
app.use(healthRoutes);               // GET /health
app.use("/api/auth", authRoutes);    // /api/auth/register, /login, /refresh, /logout, /me
app.use("/api/tickets", ticketRoutes); // /api/tickets CRUD + status + assign + comments
app.use("/api/admin", adminRoutes);  // /api/admin/... user, team, category, priority, SLA CRUD
app.use("/api/dashboard", dashboardRoutes); // /api/dashboard admin-only stats

// ─── ERROR HANDLER ──────────────────────────────────────────────
app.use(errorHandler);

// ─── START THE SERVER ───────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}

export default app;