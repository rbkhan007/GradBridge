// GET /api/files           — list the authenticated user's workspace files (auto-clones templates on first access).
// POST /api/files { path } — read a single file by path from the user's workspace.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toFile } from "@/lib/serializers";
import { requireUser } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const files = await ensureWorkspace(user.id);
  return NextResponse.json({ files: files.map(toFile) });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  let body: { path?: string };
  try {
    body = (await req.json()) as { path?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { path } = body;
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  const file = await db.projectFile.findFirst({
    where: { userId: user.id, path },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return NextResponse.json({ file: toFile(file) });
}
