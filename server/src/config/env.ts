// This file reads settings from environment variables (.env file)
// and makes them available to the rest of the app in one central place.
// Think of it like a settings panel: change things here, not scattered across code.

// Load the .env file at the very start so all variables are available
import dotenv from "dotenv";
dotenv.config({ quiet: true });

// Export each setting with a clear name and a default fallback value.
// The "process.env.X || default" pattern means: use the env var if set,
// otherwise fall back to the default. This keeps the app working in dev.

export const env = {
  // Database
  DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || "sqlite",
  DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",

  // JWT (JSON Web Token) secrets — used to sign and verify login tokens
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || "dev-access-secret",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "dev-refresh-secret",
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",

  // Server
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",

  // CORS — which frontend origin is allowed to call the API
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
};