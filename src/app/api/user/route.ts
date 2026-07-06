import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dispatchWebhook } from "@/lib/webhooks";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ user: fullUser });
}

export async function PUT(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { name }: { name?: string } = await req.json().catch(() => ({}));
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await db.user.update({ where: { id: user.id }, data: { name: name.trim() }, select: { id: true, name: true, email: true, role: true } });
  return NextResponse.json({ user: updated });
}

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  await db.user.delete({ where: { id: user.id } });
  dispatchWebhook(user.id, "user.deleted", { id: user.id }).catch(() => {});
  return NextResponse.json({ deleted: true });
}
