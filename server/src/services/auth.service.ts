// Business logic for auth: register, login, refresh, logout.
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { env } from "../config/env";
import { UnauthorizedError, ConflictError } from "../utils/errors";
import { UserRole } from "@prisma/client";

// ─── REGISTER ────────────────────────────────────────────────────────
export async function registerUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email already registered");
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: UserRole.Requester, isActive: true },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return user;
}

// ─── LOGIN ───────────────────────────────────────────────────────────
export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedError("Invalid email or password");
  if (!user.isActive) throw new UnauthorizedError("Account is deactivated");
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = await generateRefreshToken(user.id);
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId },
    accessToken,
    refreshToken,
  };
}

// ─── REFRESH ─────────────────────────────────────────────────────────
export async function refreshAccessToken(refreshTokenValue: string) {
  const hashed = hashTokenForStorage(refreshTokenValue);
  const stored = await prisma.refreshToken.findUnique({
    where: { token: hashed }, include: { user: true },
  });
  if (!stored) throw new UnauthorizedError("Invalid refresh token");
  if (new Date() > stored.expiresAt) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new UnauthorizedError("Refresh token expired");
  }
  if (!stored.user.isActive) {
    await prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
    throw new UnauthorizedError("Account is deactivated");
  }
  // Rotate tokens
  const rawToken = crypto.randomUUID();
  const [newRt] = await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        token: hashTokenForStorage(rawToken),
        userId: stored.userId,
        expiresAt: new Date(Date.now() + parseDuration(env.REFRESH_TOKEN_EXPIRES_IN)),
      },
    }),
    prisma.refreshToken.delete({ where: { id: stored.id } }),
  ]);
  const accessToken = generateAccessToken(stored.user.id, stored.user.role as UserRole);
  return {
    accessToken,
    refreshToken: rawToken,
    user: { id: stored.user.id, email: stored.user.email, name: stored.user.name, role: stored.user.role, teamId: stored.user.teamId },
  };
}

// ─── LOGOUT ─────────────────────────────────────────────────────────
export async function logoutUser(refreshTokenValue: string) {
  const hashed = hashTokenForStorage(refreshTokenValue);
  await prisma.refreshToken.deleteMany({ where: { token: hashed } });
}
// ─── TOKEN HELPERS ──────────────────────────────────────────────

function generateAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, env.ACCESS_TOKEN_SECRET, { expiresIn: parseExpirySeconds(env.ACCESS_TOKEN_EXPIRES_IN) });
}

async function generateRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomUUID();
  const hashed = hashTokenForStorage(rawToken);
  const expiresAt = new Date(Date.now() + parseDuration(env.REFRESH_TOKEN_EXPIRES_IN));
  await prisma.refreshToken.create({ data: { token: hashed, userId, expiresAt } });
  return rawToken;
}

function hashTokenForStorage(token: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(token, salt);
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60*1000, h: 60*60*1000, d: 24*60*60*1000 };
  return value * (multipliers[unit] || multipliers.d);
}

// Parse access token expiry like "15m" into seconds for JWT
function parseExpirySeconds(duration: string): number {
  return Math.floor(parseDuration(duration) / 1000);
}