import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth/server";
import type { AuthUser } from "@/lib/types";

export async function POST(req: Request) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const nameRegex = /^.{1,80}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!nameRegex.test(name)) {
    return NextResponse.json({ error: "Name must be 1-80 characters.", field: "name" }, { status: 400 });
  }
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address.", field: "email" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be 8-128 characters.", field: "password" }, { status: 400 });
  }

  // Create user via Neon Auth.
  // The Neon Auth server SDK forwards the request upstream. It reads the
  // Origin/Referer from the incoming request context; when neither is present
  // (e.g. headless clients) we provide emailRedirectTo as an absolute URL
  // fallback.
  const cbOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_ENV === "production"
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "grad-bridge-beta.vercel.app"}`
      : `http://${req.headers.get("host") || "localhost:3000"}`);
  const { data: signUpData, error: signUpError } = await (auth.signUp.email as any)({
    name,
    email,
    password,
    options: {
      emailRedirectTo: `${cbOrigin}/auth/callback`,
    },
  });

  if (signUpError) {
    if (signUpError.message?.toLowerCase().includes("already")) {
      return NextResponse.json({ error: "An account with this email already exists.", field: "email" }, { status: 409 });
    }
    console.error("[register] Neon Auth error:", signUpError);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }

  const neonUserId = signUpData?.user?.id;
  if (!neonUserId) {
    console.error("[register] No user ID returned from Neon Auth");
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }

  // Create local User + UserProfile in our DB using the same ID.
  let user: { id: string; name: string; email: string };
  try {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: neonUserId,
          email,
          name,
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists.", field: "email" }, { status: 409 });
    }
    console.error("[register] DB error:", err);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }

  const res = NextResponse.json({ user: user as AuthUser }, { status: 201 });
  return res;
}
