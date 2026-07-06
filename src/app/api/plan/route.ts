// POST /api/plan — Plan agent produces a structured markdown plan (user-scoped).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGENTS } from "@/lib/agents";
import { ragSearch } from "@/lib/rag";
import { runCompletion, type ChatTurn } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/context";
import { toProfile } from "@/lib/serializers";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  let body: { goal?: string };
  try {
    body = (await req.json()) as { goal?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { goal } = body;
  const trimmed = (goal ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }
  if (trimmed.length > 4000) {
    return NextResponse.json(
      { error: "goal too long (max 4000 chars)" },
      { status: 413 },
    );
  }

  const profileRow =
    (await db.userProfile.findUnique({ where: { userId: user.id } })) ??
    (await db.userProfile.create({ data: { userId: user.id, name: user.name } }));
  const profile = toProfile(profileRow);
  const ragResults = await ragSearch(trimmed, 5, user.id);

  const systemPrompt = buildSystemPrompt(AGENTS.plan.systemPrompt, {
    profile,
    ragResults,
  });

  const turns: ChatTurn[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Produce a structured plan for the following goal:\n\n${trimmed}`,
    },
  ];

  const result = await runCompletion(turns, { retries: 1 });

  const plan = await db.plan.create({
    data: {
      userId: user.id,
      title: trimmed.slice(0, 80),
      goal: trimmed,
      content: result.content,
      status: "draft",
    },
  });

  return NextResponse.json({
    plan: {
      id: plan.id,
      title: plan.title,
      goal: plan.goal,
      content: plan.content,
      status: plan.status as "draft" | "approved" | "applied",
      createdAt: plan.createdAt.toISOString(),
    },
    ragResults,
    tokensUsed: result.tokensUsed,
  });
}
