import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dispatchWebhook } from "@/lib/webhooks";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const conversation = await db.conversation.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const { title }: { title?: string } = await req.json().catch(() => ({}));
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const conversation = await db.conversation.findFirst({ where: { id, userId: user.id } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const updated = await db.conversation.update({ where: { id }, data: { title: title.trim() } });
  return NextResponse.json({ conversation: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const conversation = await db.conversation.findFirst({ where: { id, userId: user.id } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  await db.conversation.delete({ where: { id } });
  dispatchWebhook(user.id, "conversation.deleted", { conversationId: id }).catch(() => {});
  return NextResponse.json({ deleted: true });
}
