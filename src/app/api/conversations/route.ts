import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50") || 50, 200);
  const cursor = url.searchParams.get("cursor");

  const conversations = await db.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: { id: true, title: true, createdAt: true, updatedAt: true, _count: { select: { messages: true } } },
  });

  const hasMore = conversations.length > limit;
  if (hasMore) conversations.pop();

  return NextResponse.json({ conversations, nextCursor: hasMore ? conversations[conversations.length - 1]?.id : null });
}

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { ids }: { ids?: string[] } = await req.json().catch(() => ({}));
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Provide an array of conversation ids to delete" }, { status: 400 });
  }

  const result = await db.conversation.deleteMany({ where: { id: { in: ids }, userId: user.id } });
  return NextResponse.json({ deleted: result.count });
}
