// GET /api/memory  — fetch the current user's profile (auto-creates if missing).
// POST /api/memory — upsert the current user's profile (partial updates).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
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

async function handleGet(req: Request) {
  const user = await requireUser(req);
  const p = await getOrCreateProfile(user.id);
  return NextResponse.json({ profile: toProfile(p) });
}

async function handlePost(req: Request) {
  const user = await requireUser(req);
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

  // Ensure a profile row exists, then update.
  await getOrCreateProfile(user.id);
  const updated = await db.userProfile.update({
    where: { userId: user.id },
    data,
  });
  return NextResponse.json({ profile: toProfile(updated) });
}

export async function GET(req: Request) {
  try {
    return await handleGet(req);
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
