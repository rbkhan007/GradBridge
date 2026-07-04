// POST /api/auth/register
// Creates a new user (+ profile) in a transaction and auto-logs them in.
// Handles 100+ unique users safely via the unique email constraint, with
// explicit race-condition handling (Prisma P2002) so concurrent duplicate
// registrations return a clean 409 instead of a 500.
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  hashPassword,
  createSessionToken,
  sessionCookie,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

export async function POST(req: Request) {
  // 1. Parse body (await — Request.json() is async).
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  // 2. Input validation (synchronous).
  const nameErr = validateName(name);
  if (nameErr) {
    return NextResponse.json({ error: nameErr, field: "name" }, { status: 400 });
  }
  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address.", field: "email" },
      { status: 400 },
    );
  }
  const pwErr = validatePassword(password);
  if (pwErr) {
    return NextResponse.json(
      { error: pwErr, field: "password" },
      { status: 400 },
    );
  }

  // 3. Hash the password (await — scrypt is async).
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch {
    return NextResponse.json(
      { error: "Could not secure your password. Please try again." },
      { status: 500 },
    );
  }

  // 4. Create user + profile in a single transaction. We do NOT pre-check
  //    existence with findUnique (that's a race); instead we attempt the
  //    create and let the DB's unique constraint enforce it, catching P2002.
  let user: { id: string; name: string; email: string };
  try {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          profile: {
            create: {
              name,
              university: "",
              major: "Computer Science",
              graduationYear: new Date().getFullYear() + 1,
              targetRole: "Software Engineer",
              experienceLevel: "Entry-level / Fresh Graduate",
            },
          },
        },
        select: { id: true, name: true, email: true },
      });
      return created;
    });
  } catch (err) {
    // Prisma unique-constraint violation → friendly 409.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
          field: "email",
        },
        { status: 409 },
      );
    }
    // Any other DB error → 500 with a safe message.
    console.error("[register] DB error:", err);
    return NextResponse.json(
      { error: "Could not create your account. Please try again." },
      { status: 500 },
    );
  }

  // 5. Issue a signed session token and set the httpOnly cookie.
  const token = createSessionToken({ sub: user.id, email: user.email });
  const res = NextResponse.json({ user: user as AuthUser }, { status: 201 });
  res.headers.set("Set-Cookie", sessionCookie(token));
  return res;
}
