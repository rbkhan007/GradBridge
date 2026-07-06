// POST /api/files/commit — snapshot all modified files into a Commit, then
// reset their status to "clean". Git-like version history without a real repo.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  let body: { message?: string };
  try {
    body = (await req.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { message } = body;
  const commitMessage = (message ?? "").trim() || "Save work";
  if (commitMessage.length > 200) {
    return NextResponse.json(
      { error: "Commit message too long (max 200 chars)" },
      { status: 400 },
    );
  }

  await ensureWorkspace(user.id);

  const modified = await db.projectFile.findMany({
    where: { userId: user.id, status: { in: ["modified", "added"] } },
  });

  if (modified.length === 0) {
    return NextResponse.json(
      { error: "No modified files to commit" },
      { status: 400 },
    );
  }

  const filesJson = JSON.stringify(
    modified.map((f) => ({ path: f.path, content: f.content, language: f.language })),
  );

  const commit = await db.$transaction(async (tx) => {
    const c = await tx.commit.create({
      data: {
        userId: user.id,
        message: commitMessage,
        filesJson,
        filesCount: modified.length,
      },
    });
    await tx.projectFile.updateMany({
      where: { id: { in: modified.map((f) => f.id) } },
      data: { status: "clean" },
    });
    return c;
  });

  return NextResponse.json({
    commit: {
      id: commit.id,
      message: commit.message,
      filesCount: commit.filesCount,
      createdAt: commit.createdAt.toISOString(),
    },
  });
}
