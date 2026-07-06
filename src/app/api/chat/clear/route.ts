import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const deleted = await db.conversation.deleteMany({
    where: { userId: user.id },
  });
  return NextResponse.json({
    success: true,
    deleted: deleted.count,
  });
}
