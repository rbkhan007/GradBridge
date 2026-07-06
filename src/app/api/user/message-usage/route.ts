import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const today = new Date().toISOString().slice(0, 10);
  const usage = await db.dailyUsage.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  const keyRow = await db.userApiKey.findUnique({
    where: { userId: user.id },
    select: { provider: true },
  });
  return NextResponse.json({
    used: usage?.count ?? 0,
    limit: keyRow ? -1 : 5,
    hasKey: !!keyRow,
    date: today,
  });
}
