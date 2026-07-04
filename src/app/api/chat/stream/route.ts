// POST /api/chat/stream — streaming agent chat via Server-Sent Events.
// Same agent + RAG + memory logic as /api/chat, but streams tokens to the
// client as they arrive. Persists the full assistant message after the stream
// completes. User-scoped.
import { db } from "@/lib/db";
import { resolveAgent } from "@/lib/agents";
import { ragSearch } from "@/lib/rag";
import { streamCompletion, estimateTokens, type ChatTurn } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/context";
import { toProfile } from "@/lib/serializers";
import { requireUser, HttpError } from "@/lib/auth";
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

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 401;
    return sseError(err instanceof HttpError ? err.message : "Not authenticated", status);
  }

  const message = (body.message ?? "").trim();
  if (!message) return sseError("message is required");
  if (message.length > 8000) return sseError("message too long (max 8000 chars)");

  const mode = body.mode ?? "chat";
  const agent = resolveAgent(mode, body.agentId);

  try {
    // 1. Load or create the conversation.
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

    // 2. Profile + RAG + active file.
    const profileRow =
      (await db.userProfile.findUnique({ where: { userId: user.id } })) ??
      (await db.userProfile.create({ data: { userId: user.id, name: user.name } }));
    const profile = toProfile(profileRow);

    const ragResults = body.context?.ragResults?.length
      ? body.context.ragResults
      : await ragSearch(message, 4, user.id);

    let activeFile: { path: string; content: string } | null = null;
    if (body.context?.activeFilePath) {
      const f = await db.projectFile.findFirst({
        where: { userId: user.id, path: body.context.activeFilePath },
      });
      if (f) activeFile = { path: f.path, content: f.content };
    }

    // 3. System prompt + turns.
    const systemPrompt = buildSystemPrompt(agent.systemPrompt, {
      profile,
      ragResults,
      activeFile,
    });
    const history = conversation.messages.slice(-12);
    const turns: ChatTurn[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // 4. Check API key and daily usage.
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
        const encoder2 = new TextEncoder();
        const limitStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder2.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error: "Daily free message limit reached (5/5). Add your own API key in Settings for unlimited usage.",
                })}\n\n`,
              ),
            );
            controller.close();
          },
        });
        return new Response(limitStream, {
          status: 429,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
    }

    // 5. Persist the user message.
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message,
        agentMode: mode,
      },
    });

    // 5. Stream the response via SSE.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = "";
        let provider = "unknown";

        // Send metadata first.
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "meta",
              conversationId: conversation!.id,
              ragResults,
              agentId: agent.id,
              agentName: agent.name,
            })}\n\n`,
          ),
        );

        try {
          for await (const chunk of streamCompletion(turns, { userApiKey: userApiKey ?? undefined })) {
            if (chunk.delta) {
              fullContent += chunk.delta;
              provider = chunk.provider;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "delta", content: chunk.delta })}\n\n`,
                ),
              );
            }
            if (chunk.done) {
              provider = chunk.provider;
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: msg })}\n\n`,
            ),
          );
        }

        // 6. Persist the assistant message + audit run (with error handling).
        if (fullContent.trim()) {
          try {
            const tokensUsed =
              estimateTokens(turns) +
              estimateTokens([{ role: "assistant", content: fullContent }]);

            const result = await db.$transaction(async (tx) => {
              const assistantRow = await tx.message.create({
                data: {
                  conversationId: conversation!.id,
                  role: "assistant",
                  content: fullContent,
                  agentMode: mode,
                  agentId: agent.id,
                },
              });
              await tx.agentRun.create({
                data: {
                  userId: user!.id,
                  conversationId: conversation!.id,
                  mode,
                  agentId: agent.id,
                  prompt: message,
                  result: fullContent,
                  tokensUsed,
                },
              });
              await tx.conversation.update({
                where: { id: conversation!.id },
                data: { updatedAt: new Date() },
              });

              // Track daily free usage (only when using the shared fallback key).
              if (!userApiKey) {
                const today = new Date().toISOString().slice(0, 10);
                await tx.dailyUsage.upsert({
                  where: { userId_date: { userId: user!.id, date: today } },
                  create: { userId: user!.id, date: today, count: 1 },
                  update: { count: { increment: 1 } },
                });
              }

              return { messageId: assistantRow.id, tokensUsed };
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  messageId: result.messageId,
                  provider,
                  tokensUsed: result.tokensUsed,
                })}\n\n`,
              ),
            );
          } catch (dbErr) {
            console.error("[chat/stream] Failed to persist assistant message:", dbErr);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done", provider })}\n\n`,
              ),
            );
          }
        } else {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", provider })}\n\n`,
            ),
          );
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return sseError(`Agent failed: ${msg}`);
  }
}

/** Return an SSE-formatted error response. */
function sseError(message: string, status = 400): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`),
      );
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}
