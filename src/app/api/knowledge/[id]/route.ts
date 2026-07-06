import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { authorize } from "@/lib/auth/authorize";
import { dispatchWebhook } from "@/lib/webhooks";
import { indexToVectorStore } from "@/lib/rag";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize(req, "admin", "moderator");
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const { title, category, content, tags, source }: {
    title?: string; category?: string; content?: string; tags?: string[]; source?: string;
  } = await req.json().catch(() => ({}));

  const existing = await db.knowledgeEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Knowledge entry not found" }, { status: 404 });

  const validCategories = ["roadmap", "interview", "best-practice", "career", "system-design"];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json({ error: `Category must be one of: ${validCategories.join(", ")}` }, { status: 400 });
  }

  const entry = await db.knowledgeEntry.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(category ? { category } : {}),
      ...(content ? { content } : {}),
      ...(source ? { source } : {}),
      ...(tags ? { tags: JSON.stringify(tags) } : {}),
    },
  });

  indexToVectorStore().catch(() => {});
  dispatchWebhook(user.id, "knowledge.updated", { entryId: id, title: entry.title }).catch(() => {});
  return NextResponse.json({ entry });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize(req, "admin", "moderator");
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await db.knowledgeEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Knowledge entry not found" }, { status: 404 });

  await db.knowledgeEntry.delete({ where: { id } });
  indexToVectorStore().catch(() => {});
  dispatchWebhook(user.id, "knowledge.deleted", { entryId: id }).catch(() => {});
  return NextResponse.json({ deleted: true });
}
