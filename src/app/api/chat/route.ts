// POST /api/chat — the main agent endpoint (user-scoped).
// Runs RAG, builds a personalized system prompt, calls the LLM with fallback,
// persists the conversation + an audit AgentRun, and returns the assistant message.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAgent } from "@/lib/agents";
import { ragSearch } from "@/lib/rag";
import { runCompletion, type ChatTurn } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/context";
import { toMessage, toProfile } from "@/lib/serializers";
import { requireUser, HttpError } from "@/lib/auth";
import type { ChatRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handler(req: Request) {
  const user = await requireUser(req);

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json(
      { error: "message too long (max 8000 chars)" },
      { status: 413 },
    );
  }

  const mode = body.mode ?? "chat";
  const agent = resolveAgent(mode, body.agentId);

  // 1. Load or create the user's conversation.
  let conversation = body.conversationId
    ? await db.conversation.findFirst({
        where: { id: body.conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { userId: user.id, title: message.slice(0, 60) },
      include: { messages: true },
    });
  }

  // 2. Load the user's profile (memory).
  const profileRow =
    (await db.userProfile.findUnique({ where: { userId: user.id } })) ??
    (await db.userProfile.create({ data: { userId: user.id, name: user.name } }));
  const profile = toProfile(profileRow);

  // 3. Run RAG over the user message + the user's files.
  const ragResults = body.context?.ragResults?.length
    ? body.context.ragResults
    : await ragSearch(message, 4, user.id);

  // 4. Optionally pull the active file's content from the user's workspace.
  let activeFile: { path: string; content: string } | null = null;
  if (body.context?.activeFilePath) {
    const f = await db.projectFile.findFirst({
      where: { userId: user.id, path: body.context.activeFilePath },
    });
    if (f) activeFile = { path: f.path, content: f.content };
  }

  // 5. Build the system prompt.
  const systemPrompt = buildSystemPrompt(agent.systemPrompt, {
    profile,
    ragResults,
    activeFile,
  });

  // 6. Check API key and daily usage.
  let userApiKey: string | null = null;
  let freeUsed = 0;
  const keyRow = await db.userApiKey.findUnique({ where: { userId: user.id } });
  if (keyRow) {
    userApiKey = keyRow.apiKey;
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const usage = await db.dailyUsage.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });
    freeUsed = usage?.count ?? 0;
    if (freeUsed >= 5) {
      return NextResponse.json(
        { error: "Daily free message limit reached (5/5). Add your own API key in Settings for unlimited usage." },
        { status: 429 },
      );
    }
  }

  // 6. Assemble LLM turns.
  const history = conversation.messages.slice(-12);
  const turns: ChatTurn[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  // 7. Persist the user message first.
  await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: message,
      agentMode: mode,
    },
  });

  // 8. Call the LLM (with provider fallback + retry).
  const result = await runCompletion(turns, { retries: 1, userApiKey: userApiKey ?? undefined });

  // 9. Persist the assistant message.
  const assistantRow = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: result.content,
      agentMode: mode,
      agentId: agent.id,
    },
  });

  // 10. Audit run (scoped to the user).
  await db.agentRun.create({
    data: {
      userId: user.id,
      conversationId: conversation.id,
      mode,
      agentId: agent.id,
      prompt: message,
      result: result.content,
      tokensUsed: result.tokensUsed,
    },
  });

  // 11. Track daily free usage (only when using the shared fallback key).
  if (!userApiKey) {
    const today = new Date().toISOString().slice(0, 10);
    await db.dailyUsage.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      create: { userId: user.id, date: today, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  await db.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    conversationId: conversation.id,
    message: toMessage(assistantRow),
    ragResults,
    tokensUsed: result.tokensUsed,
    provider: result.provider,
  });
}

export async function POST(req: Request) {
  try {
    return await handler(req);
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Agent failed", detail: msg },
      { status: 500 },
    );
  }
}
