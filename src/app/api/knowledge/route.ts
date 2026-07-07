import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { authorize } from "@/lib/auth/authorize";
import { dispatchWebhook } from "@/lib/webhooks";
import { indexToVectorStore } from "@/lib/rag";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");

  const where: any = {};
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ];
  }

  const entries = await db.knowledgeEntry.findMany({
    where,
    orderBy: [{ category: "asc" }, { title: "asc" }],
    take: 100,
  });

  const parsed = entries.map((e) => ({
    ...e,
    tags: JSON.parse(e.tags || "[]") as string[],
  }));

  return NextResponse.json({ entries: parsed });
}

export async function POST(req: Request) {
  const user = await authorize(req, "admin", "moderator");
  if (user instanceof NextResponse) return user;

  const { title, category, content, tags, source }: {
    title: string; category: string; content: string; tags?: string[]; source?: string;
  } = await req.json().catch(() => ({}));

  if (!title || !category || !content) {
    return NextResponse.json({ error: "title, category, and content are required" }, { status: 400 });
  }

  const validCategories = ["roadmap", "interview", "best-practice", "career", "system-design"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: `Category must be one of: ${validCategories.join(", ")}` }, { status: 400 });
  }

  const entry = await db.knowledgeEntry.create({
    data: { title, category, content, source: source ?? "GradBridge Knowledge Base", tags: JSON.stringify(tags ?? []) },
  });

  indexToVectorStore().catch(() => {});
  dispatchWebhook(user.id, "knowledge.created", { entryId: entry.id, title }).catch(() => {});
  return NextResponse.json({ entry }, { status: 201 });
}
