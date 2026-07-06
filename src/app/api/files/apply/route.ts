// POST /api/files/apply — write approved content back to the user's file.
// Marks the file as "modified" and updates indexedAt. User-scoped.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toFile } from "@/lib/serializers";
import { requireUser } from "@/lib/auth";
import { indexToVectorStore } from "@/lib/rag";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  let body: { path?: string; content?: string };
  try {
    body = (await req.json()) as { path?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { path, content } = body;
  if (!path || typeof content !== "string") {
    return NextResponse.json(
      { error: "path and content are required" },
      { status: 400 },
    );
  }
  if (content.length > 200_000) {
    return NextResponse.json(
      { error: "content too large (max 200k chars)" },
      { status: 413 },
    );
  }

  const existing = await db.projectFile.findFirst({
    where: { userId: user.id, path },
  });
  if (!existing) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const updated = await db.projectFile.update({
    where: { id: existing.id },
    data: {
      content,
      status: "modified",
      indexedAt: new Date(),
    },
  });
  indexToVectorStore(user.id).catch(() => {});
  return NextResponse.json({ file: toFile(updated) });
}
