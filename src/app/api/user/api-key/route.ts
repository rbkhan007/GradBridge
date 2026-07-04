import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";

/** Mask an API key: show only first 8 and last 4 characters. */
function maskKey(key: string): string {
  if (key.length <= 16) return "****";
  return `${key.slice(0, 8)}${"*".repeat(key.length - 12)}${key.slice(-4)}`;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const keyRow = await db.userApiKey.findUnique({
      where: { userId: user.id },
      select: { provider: true, apiKey: true },
    });
    return NextResponse.json({
      hasKey: !!keyRow,
      provider: keyRow?.provider ?? null,
      apiKey: keyRow?.apiKey ? maskKey(keyRow.apiKey) : null,
    });
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load API key" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    let body: { provider?: string; apiKey?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const provider = body.provider ?? "openrouter";
    const apiKey = (body.apiKey ?? "").trim();
    if (!apiKey) {
      await db.userApiKey.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ success: true, hasKey: false });
    }
    await db.userApiKey.upsert({
      where: { userId: user.id },
      create: { userId: user.id, provider, apiKey },
      update: { provider, apiKey },
    });
    return NextResponse.json({ success: true, hasKey: true, provider });
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 });
  }
}
