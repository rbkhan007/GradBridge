import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await db.webhookEndpoint.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

  const { url, events, enabled }: { url?: string; events?: string[]; enabled?: boolean } = await req.json().catch(() => ({}));

  const data: any = {};
  if (url !== undefined) { if (typeof url !== "string" || !url.startsWith("https://")) return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); data.url = url; }
  if (events !== undefined) { if (!Array.isArray(events) || events.length === 0) return NextResponse.json({ error: "At least one event required" }, { status: 400 }); data.events = JSON.stringify(events); }
  if (enabled !== undefined) data.enabled = enabled;

  const endpoint = await db.webhookEndpoint.update({ where: { id }, data });
  return NextResponse.json({ endpoint: { ...endpoint, events: JSON.parse(endpoint.events) } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await db.webhookEndpoint.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

  await db.webhookEndpoint.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
