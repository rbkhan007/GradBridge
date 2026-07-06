import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50") || 50, 200);
  const status = url.searchParams.get("status");

  const plans = await db.plan.findMany({
    where: { userId: user.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ plans });
}
