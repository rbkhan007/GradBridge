// Zero-dependency auth for GradBridge.
// - Password hashing: Node scrypt + per-user salt (timing-safe compare)
// - Session: HMAC-SHA256 signed JWT in an httpOnly cookie
// Designed to handle 100+ unique users. No external packages required.

import {
  scrypt as scryptCb,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// Generate a random per-instance secret if GRADBRIDGE_SECRET is not set.
// In production this MUST be set via env for session persistence across restarts.
function getSecret(): string {
  const envSecret = process.env.GRADBRIDGE_SECRET;
  if (envSecret) return envSecret;
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] WARNING: GRADBRIDGE_SECRET not set — sessions will not survive restarts");
  }
  return randomBytes(32).toString("hex");
}
const SECRET = getSecret();
const KEYLEN = 64;
export const SESSION_COOKIE_NAME = "gb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** Hash a password with a random salt using scrypt. Output: `scrypt$saltHex$hashHex`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verify a password against a stored scrypt hash (timing-safe). */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const derived = await scrypt(password, salt, KEYLEN);
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

/** Create a signed session JWT for a user. */
export function createSessionToken(payload: {
  sub: string;
  email: string;
}): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
  );
  const sig = createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

/** Verify a session JWT signature + expiry. Returns the payload or null. */
export function verifySessionToken(token: string):
  | { sub: string; email: string; exp?: number }
  | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    if (!payload.sub || !payload.email) return null;
    return { sub: payload.sub, email: payload.email, exp: payload.exp };
  } catch {
    return null;
  }
}

/** Parse a single cookie value out of a Cookie header. */
export function parseCookie(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Read the session token from a Request's Cookie header. */
export function readSessionToken(req: Request): string | null {
  return parseCookie(req.headers.get("cookie"), SESSION_COOKIE_NAME);
}

/** Resolve the current authenticated user from a request, or null. */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  return user;
}

/** HTTP error carrying a status code, for use in route handlers. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Require an authenticated user; throws HttpError(401) otherwise. */
export async function requireUser(req: Request): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

/** Build the Set-Cookie header value for a session token. */
export function sessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Build the Set-Cookie header value that clears the session cookie. */
export function clearSessionCookie(): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

// --- Input validation helpers ---

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  return null;
}

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1) return "Name is required.";
  if (trimmed.length > 80) return "Name must be at most 80 characters.";
  return null;
}
