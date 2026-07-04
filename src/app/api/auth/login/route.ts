// POST /api/auth/login
// Verifies credentials and sets the session cookie. Uses a constant-time
// dummy verify when the email is not found to prevent timing-based user
// enumeration. All async DB + crypto calls are wrapped in try/catch.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  createSessionToken,
  sessionCookie,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

// A pre-hashed dummy value used to keep verify timing consistent when the
// email does not exist (prevents enumeration via response timing).
const DUMMY_HASH =
  "scrypt$6f3a1e2c4b5d6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f$" +
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export async function POST(req: Request) {
  // 1. Parse body (await).
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  // 2. Look up the user (await).
  let user: { id: string; name: string; email: string; passwordHash: string } | null;
  try {
    user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
  } catch (err) {
    console.error("[login] DB error:", err);
    return NextResponse.json(
      { error: "Could not sign you in. Please try again." },
      { status: 500 },
    );
  }

  // 3. Always run a password verify (constant-time-ish) to avoid leaking
  //    whether the email exists via response timing.
  let ok = false;
  try {
    ok = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, DUMMY_HASH);
  } catch (err) {
    console.error("[login] verify error:", err);
    ok = false;
  }

  if (!user || !ok) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  // 4. Issue the session token + cookie.
  const token = createSessionToken({ sub: user.id, email: user.email });
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email } as AuthUser,
  });
  res.headers.set("Set-Cookie", sessionCookie(token));
  return res;
}
