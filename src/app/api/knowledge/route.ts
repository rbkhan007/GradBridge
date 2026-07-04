// GET /api/knowledge        — list all knowledge-base entries (auth required).
// GET /api/knowledge?q=...  — query the knowledge base (RAG-lite).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toKnowledge } from "@/lib/serializers";
import { requireUser, HttpError } from "@/lib/auth";

async function handler(req: Request) {
  await requireUser(req);
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!q) {
    const entries = await db.knowledgeEntry.findMany({
      orderBy: [{ category: "asc" }, { title: "asc" }],
      take: 50,
    });
    return NextResponse.json({ entries: entries.map(toKnowledge) });
  }

  const all = await db.knowledgeEntry.findMany({ take: 100 });
  const ql = q.toLowerCase();
  const matched = all
    .filter((k) => {
      const tags = (() => {
        try {
          return JSON.parse(k.tags) as string[];
        } catch {
          return [];
        }
      })();
      return (
        k.title.toLowerCase().includes(ql) ||
        k.category.toLowerCase().includes(ql) ||
        k.content.toLowerCase().includes(ql) ||
        tags.some((t) => t.toLowerCase().includes(ql))
      );
    })
    .slice(0, 20);
  return NextResponse.json({ entries: matched.map(toKnowledge), query: q });
}

export async function GET(req: Request) {
  try {
    return await handler(req);
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load knowledge" }, { status: 500 });
  }
}
