import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dispatchWebhook } from "@/lib/webhooks";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const plan = await db.plan.findFirst({ where: { id, userId: user.id } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const { status, title, content, goal }: { status?: string; title?: string; content?: string; goal?: string } = body;

  const existing = await db.plan.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const validStatuses = ["draft", "approved", "applied"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: `Status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const plan = await db.plan.update({
    where: { id },
    data: { ...(title ? { title } : {}), ...(content ? { content } : {}), ...(goal ? { goal } : {}), ...(status ? { status } : {}) },
  });

  if (status) {
    dispatchWebhook(user.id, "plan.status_changed", { planId: id, oldStatus: existing.status, newStatus: status }).catch(() => {});
  }

  return NextResponse.json({ plan });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const plan = await db.plan.findFirst({ where: { id, userId: user.id } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  await db.plan.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
