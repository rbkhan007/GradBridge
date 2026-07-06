import { db } from "@/lib/db";
import { resolveAgent } from "@/lib/agents";
import { ragSearch } from "@/lib/rag";
import { streamCompletion, type ChatTurn } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/context";
import { toProfile } from "@/lib/serializers";
import { requireUser } from "@/lib/auth";
import type { ChatRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return sseError("Invalid JSON body");
  }

  const user = await requireUser(req);
  if (user instanceof Response) return sseError("Not authenticated", 401);

  const message = (body.message ?? "").trim();
  if (!message) return sseError("message is required");
  if (message.length > 8000) return sseError("message too long (max 8000 chars)");

  const mode = body.mode ?? "chat";
  const agent = resolveAgent(mode, body.agentId);

  try {
    let conversation = body.conversationId
      ? await db.conversation.findFirst({ where: { id: body.conversationId, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } })
      : null;
    if (!conversation) {
      conversation = await db.conversation.create({ data: { userId: user.id, title: message.slice(0, 60) }, include: { messages: true } });
    }

    const profileRow = (await db.userProfile.findUnique({ where: { userId: user.id } })) ?? (await db.userProfile.create({ data: { userId: user.id, name: user.name } }));
    const profile = toProfile(profileRow);

    const ragResults = body.context?.ragResults?.length ? body.context.ragResults : await ragSearch(message, 4, user.id);

    let activeFile: { path: string; content: string } | null = null;
    if (body.context?.activeFilePath) {
      const f = await db.projectFile.findFirst({ where: { userId: user.id, path: body.context.activeFilePath } });
      if (f) activeFile = { path: f.path, content: f.content };
    }

    const systemPrompt = buildSystemPrompt(agent.systemPrompt, { profile, ragResults, activeFile });

    let userApiKey: string | null = null;
    const keyRow = await db.userApiKey.findUnique({ where: { userId: user.id } });
    if (keyRow) {
      userApiKey = keyRow.apiKey;
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const usage = await db.dailyUsage.findUnique({ where: { userId_date: { userId: user.id, date: today } } });
      const freeUsed = usage?.count ?? 0;
      if (freeUsed >= 5) {
        return sseError("Daily free message limit reached (5/5). Add your own API key in Settings for unlimited usage.", 429);
      }
    }

    const history = conversation.messages.slice(-12);
    const turns: ChatTurn[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    await db.message.create({ data: { conversationId: conversation.id, role: "user", content: message, agentMode: mode } });

    const encoder = new TextEncoder();
    let fullContent = "";
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const gen = streamCompletion(turns, { userApiKey: userApiKey ?? undefined });
          for await (const chunk of gen) {
            fullContent += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", content: chunk })}\n\n`));
          }
        } catch (streamErr) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Stream failed" })}\n\n`));
          controller.close();
          return;
        }

        try {
          const assistantRow = await db.message.create({ data: { conversationId: conversation.id, role: "assistant", content: fullContent, agentMode: mode, agentId: agent.id } });
          const tokensUsed = Math.ceil(fullContent.length / 4);
          await db.agentRun.create({ data: { userId: user.id, conversationId: conversation.id, mode, agentId: agent.id, prompt: message, result: fullContent, tokensUsed } });
          if (!userApiKey) {
            const today = new Date().toISOString().slice(0, 10);
            await db.dailyUsage.upsert({ where: { userId_date: { userId: user.id, date: today } }, create: { userId: user.id, date: today, count: 1 }, update: { count: { increment: 1 } } });
          }
          await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", conversationId: conversation.id, messageId: assistantRow.id })}\n\n`));
        } catch (persistErr) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Failed to persist message" })}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return sseError("Agent failed");
  }
}

function sseError(message: string, status = 400): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}
