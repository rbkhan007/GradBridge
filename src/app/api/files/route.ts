// GET /api/files           — list the authenticated user's workspace files (auto-clones templates on first access).
// POST /api/files { path } — read a single file by path from the user's workspace.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toFile } from "@/lib/serializers";
import { requireUser, HttpError } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace";

async function handleGet(req: Request) {
  const user = await requireUser(req);
  const files = await ensureWorkspace(user.id);
  return NextResponse.json({ files: files.map(toFile) });
}

async function handlePost(req: Request) {
  const user = await requireUser(req);
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

export async function GET(req: Request) {
  try {
    return await handleGet(req);
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load files" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
