import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50") || 50, 200);
  const skill = url.searchParams.get("skill");

  const audits = await db.skillAudit.findMany({
    where: { userId: user.id, ...(skill ? { skill } : {}) },
    orderBy: { auditedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ skills: audits });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { skill, category, score, evidence, notes }: {
    skill?: string; category?: string; score?: number; evidence?: string; notes?: string;
  } = await req.json().catch(() => ({}));

  if (!skill || typeof skill !== "string" || skill.trim().length === 0) {
    return NextResponse.json({ error: "skill is required" }, { status: 400 });
  }
  if (score === undefined || score < 0 || score > 100) {
    return NextResponse.json({ error: "score must be between 0 and 100" }, { status: 400 });
  }

  const validCategories = ["technical", "soft", "career"];
  const cat = category && validCategories.includes(category) ? category : "technical";

  const audit = await db.skillAudit.create({
    data: { userId: user.id, skill: skill.trim(), category: cat, score, evidence: evidence ?? "", notes: notes ?? "" },
  });

  return NextResponse.json({ skill: audit }, { status: 201 });
}
