import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const endpoints = await db.webhookEndpoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const parsed = endpoints.map((ep) => ({
    ...ep,
    events: JSON.parse(ep.events || "[]") as string[],
  }));

  return NextResponse.json({ endpoints: parsed });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { url, events }: { url?: string; events?: string[] } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string" || !url.startsWith("https://")) {
    return NextResponse.json({ error: "A valid https URL is required" }, { status: 400 });
  }
  if (!events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
  }

  const endpoint = await db.webhookEndpoint.create({
    data: { userId: user.id, url, events: JSON.stringify(events), enabled: true },
  });

  return NextResponse.json({ endpoint: { ...endpoint, events: JSON.parse(endpoint.events) } }, { status: 201 });
}
