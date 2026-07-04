// GET /api/files/commits — list the user's commit history (newest first).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";

async function handler(req: Request) {
  const user = await requireUser(req);
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

export async function GET(req: Request) {
  try {
    return await handler(req);
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load commits" }, { status: 500 });
  }
}
