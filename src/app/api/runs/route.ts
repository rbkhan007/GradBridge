import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50") || 50, 200);
  const mode = url.searchParams.get("mode");
  const agentId = url.searchParams.get("agentId");
  const status = url.searchParams.get("status");

  const runs = await db.agentRun.findMany({
    where: { userId: user.id, ...(mode ? { mode } : {}), ...(agentId ? { agentId } : {}), ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ runs });
}
