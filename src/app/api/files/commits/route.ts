// GET /api/files/commits — list the user's commit history (newest first).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const commits = await db.commit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      message: true,
      filesCount: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    commits: commits.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
