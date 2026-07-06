// GET /api/memory  — fetch the current user's profile (auto-creates if missing).
// POST /api/memory — upsert the current user's profile (partial updates).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toProfile } from "@/lib/serializers";
import type { UserProfile } from "@/lib/types";

async function getOrCreateProfile(userId: string) {
  const existing = await db.userProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await db.user.findUnique({ where: { id: userId } });
  return db.userProfile.create({
    data: {
      userId,
      name: user?.name ?? "Graduate",
    },
  });
}

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const p = await getOrCreateProfile(user.id);
  return NextResponse.json({ profile: toProfile(p) });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  let body: Partial<UserProfile>;
  try {
    body = (await req.json()) as Partial<UserProfile>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.slice(0, 80);
  if (typeof body.university === "string") data.university = body.university.slice(0, 120);
  if (typeof body.major === "string") data.major = body.major.slice(0, 120);
  if (typeof body.targetRole === "string") data.targetRole = body.targetRole.slice(0, 120);
  if (typeof body.experienceLevel === "string")
    data.experienceLevel = body.experienceLevel.slice(0, 120);
  if (typeof body.graduationYear === "number")
    data.graduationYear = Math.max(1980, Math.min(2100, body.graduationYear));
  if (Array.isArray(body.skills))
    data.skills = JSON.stringify(body.skills.slice(0, 40).map(String));
  if (Array.isArray(body.goals))
    data.goals = JSON.stringify(body.goals.slice(0, 20).map(String));

  await getOrCreateProfile(user.id);
  const updated = await db.userProfile.update({
    where: { userId: user.id },
    data,
  });
  return NextResponse.json({ profile: toProfile(updated) });
}
