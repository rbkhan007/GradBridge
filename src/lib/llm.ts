// LLM orchestration for GradBridge — multi-provider with rotation + streaming.
//
// Providers (tried in order until one succeeds):
//   1. z-ai-web-dev-sdk (GLM family)         — always available, primary
//   2. OpenRouter (DeepSeek, Qwen, etc.)     — env: OPENROUTER_API_KEY
//   3. Groq (Llama, Mixtral)                 — env: GROQ_API_KEY
//   4. Ollama (local models)                 — env: OLLAMA_BASE_URL (default http://localhost:11434)
//   5. Local fallback                        — deterministic, always works
//
// All providers implement the same interface, so the agent layer doesn't care
// which one answered. Streaming is supported via streamCompletion().
import ZAI from "z-ai-web-dev-sdk";

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LlmResult {
  content: string;
  tokensUsed: number;
  provider: string;
}

/** A provider that can produce a full completion. */
export interface LlmProvider {
  name: string;
  available: boolean;
  complete(messages: ChatTurn[]): Promise<LlmResult>;
}

/** A provider that can stream tokens (SSE). Optional capability. */
export interface StreamingProvider extends LlmProvider {
  /** Stream tokens as an async iterable of string deltas. */
  stream(messages: ChatTurn[]): AsyncIterable<string>;
}

/** Rough token estimate (~4 chars/token). */
export function estimateTokens(messages: ChatTurn[]): number {
  const chars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(chars / 4);
}

/* ============================================================
 * Provider 1: z-ai-web-dev-sdk (GLM) — primary, always available
 * ============================================================ */

class ZaiProvider implements StreamingProvider {
  name = "zai-glm";
  available = true;
  private clientPromise: Promise<unknown> | null = null;

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = ZAI.create();
    }
    return this.clientPromise as Promise<Awaited<ReturnType<typeof ZAI.create>>>;
  }

  async complete(messages: ChatTurn[]): Promise<LlmResult> {
    const zai = await this.getClient();
    const mapped = messages.map((m) =>
      m.role === "system" ? { role: "assistant" as const, content: m.content } : m,
    );
    const completion = await zai.chat.completions.create({
      messages: mapped,
      thinking: { type: "disabled" },
    });
    const content = completion.choices[0]?.message?.content ?? "";
    return {
      content,
      tokensUsed:
        estimateTokens(messages) + estimateTokens([{ role: "assistant", content }]),
      provider: this.name,
    };
  }

  async *stream(messages: ChatTurn[]): AsyncIterable<string> {
    const zai = await this.getClient();
    const mapped = messages.map((m) =>
      m.role === "system" ? { role: "assistant" as const, content: m.content } : m,
    );
    // The SDK returns response.body (a ReadableStream) when stream:true.
    const body = (await zai.chat.completions.create({
      messages: mapped,
      stream: true,
      thinking: { type: "disabled" },
    })) as ReadableStream<Uint8Array>;

    yield* parseSseStream(body);
  }
}

/* ============================================================
 * Provider 2: OpenRouter — OpenAI-compatible API
 * ============================================================ */

class OpenRouterProvider implements StreamingProvider {
  name = "openrouter";
  available = true; // set dynamically in buildProviders
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";
  private model = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-coder";
  private fallbackKey = process.env.OPENROUTER_FALLBACK_KEY ?? "";

  private apiKey: string | null = null;

  setApiKey(key: string | null) {
    this.apiKey = key;
  }

  private getKey(): string {
    return this.apiKey ?? this.fallbackKey;
  }

  async complete(messages: ChatTurn[]): Promise<LlmResult> {
    const key = this.getKey();
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://gradbridge.dev",
        "X-Title": "GradBridge",
      },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens?: number };
    };
    const content = data.choices[0]?.message?.content ?? "";
    return {
      content,
      tokensUsed: data.usage?.total_tokens ?? estimateTokens(messages),
      provider: this.name,
    };
  }

  async *stream(messages: ChatTurn[]): AsyncIterable<string> {
    const key = this.getKey();
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://gradbridge.dev",
        "X-Title": "GradBridge",
      },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenRouter stream ${res.status}`);
    yield* parseSseStream(res.body);
  }
}

/* ============================================================
 * Provider 3: Groq — OpenAI-compatible, fast inference
 * ============================================================ */

class GroqProvider implements StreamingProvider {
  name = "groq";
  available = !!process.env.GROQ_API_KEY;
  private baseUrl = "https://api.groq.com/openai/v1/chat/completions";
  private model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  async complete(messages: ChatTurn[]): Promise<LlmResult> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens?: number };
    };
    const content = data.choices[0]?.message?.content ?? "";
    return {
      content,
      tokensUsed: data.usage?.total_tokens ?? estimateTokens(messages),
      provider: this.name,
    };
  }

  async *stream(messages: ChatTurn[]): AsyncIterable<string> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`Groq stream ${res.status}`);
    yield* parseSseStream(res.body);
  }
}

/* ============================================================
 * Provider 4: Ollama — local models (OpenAI-compat endpoint)
 * ============================================================ */

class OllamaProvider implements StreamingProvider {
  name = "ollama";
  available = !!process.env.OLLAMA_BASE_URL || false;
  private baseUrl =
    (process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:11434") +
    "/v1/chat/completions";
  private model = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";

  async complete(messages: ChatTurn[]): Promise<LlmResult> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens?: number };
    };
    const content = data.choices[0]?.message?.content ?? "";
    return {
      content,
      tokensUsed: data.usage?.total_tokens ?? estimateTokens(messages),
      provider: this.name,
    };
  }

  async *stream(messages: ChatTurn[]): AsyncIterable<string> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama stream ${res.status}`);
    yield* parseSseStream(res.body);
  }
}

/* ============================================================
 * Provider 5: Local fallback — deterministic, always works
 * ============================================================ */

class FallbackProvider implements LlmProvider {
  name = "local-fallback";
  available = true;

  async complete(messages: ChatTurn[]): Promise<LlmResult> {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const userText = last?.content ?? "";
    const content = `> ⚠️ All LLM providers are unavailable, so this is a local fallback response.

I received your request (${userText.slice(0, 120)}${userText.length > 120 ? "…" : ""}) but cannot reach any model right now. Please check your provider configuration (OPENROUTER_API_KEY, GROQ_API_KEY, OLLAMA_BASE_URL) or retry in a moment.

In the meantime, here's how I would approach this:
1. Decompose the request into the smallest verifiable steps.
2. Pull relevant context from the knowledge base and indexed files.
3. Produce a plan (Plan mode) before writing any code (Build mode).`;
    return { content, tokensUsed: estimateTokens(messages), provider: this.name };
  }
}

/* ============================================================
 * Provider registry — ordered by preference
 * ============================================================ */

const fallbackProvider = new FallbackProvider();

/** List all configured providers and their availability (for /api/agents). */
export function listProviders(): { name: string; available: boolean; primary: boolean }[] {
  return [
    { name: "zai-glm", available: true, primary: true },
    { name: "openrouter", available: !!(process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_FALLBACK_KEY), primary: false },
    { name: "groq", available: !!process.env.GROQ_API_KEY, primary: false },
    { name: "ollama", available: !!process.env.OLLAMA_BASE_URL, primary: false },
    { name: fallbackProvider.name, available: true, primary: false },
  ];
}

/**
 * Run a completion with automatic provider rotation + retry.
 * Tries each available provider in order; on failure moves to the next.
 */
export async function runCompletion(
  messages: ChatTurn[],
  opts: { retries?: number; userApiKey?: string } = {},
): Promise<LlmResult> {
  const retries = opts.retries ?? 1;
  let lastError: unknown = null;

  const providers = buildProviders(opts.userApiKey);

  for (const provider of providers) {
    if (!provider.available) continue;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await provider.complete(messages);
        if (result.content && result.content.trim().length > 0) {
          return result;
        }
        throw new Error("Empty response from provider");
      } catch (err) {
        lastError = err;
        console.warn(
          `[llm] ${provider.name} attempt ${attempt + 1} failed:`,
          err instanceof Error ? err.message : String(err),
        );
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }

  // Last resort: local fallback (never throws).
  return fallbackProvider.complete(messages);
}

/**
 * Stream a completion via SSE. Yields { delta, provider } events.
 * Tries streaming providers in order; if none stream successfully, falls back
 * to a non-streaming completion and yields the full content as one delta.
 */
export async function* streamCompletion(
  messages: ChatTurn[],
  opts: { userApiKey?: string } = {},
): AsyncIterable<{ delta: string; provider: string; done: boolean }> {
  let lastError: unknown = null;

  const providers = buildProviders(opts.userApiKey);

  for (const provider of providers) {
    if (!provider.available) continue;
    try {
      let receivedAny = false;
      for await (const delta of provider.stream(messages)) {
        if (delta) {
          receivedAny = true;
          yield { delta, provider: provider.name, done: false };
        }
      }
      if (receivedAny) {
        yield { delta: "", provider: provider.name, done: true };
        return;
      }
      throw new Error("Stream produced no output");
    } catch (err) {
      lastError = err;
      console.warn(
        `[llm:stream] ${provider.name} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Fallback: non-streaming completion, yielded as a single delta.
  console.warn("[llm:stream] All streaming providers failed, using fallback");
  const result = await fallbackProvider.complete(messages);
  yield { delta: result.content, provider: result.provider, done: false };
  yield { delta: "", provider: result.provider, done: true };
}

function buildProviders(userApiKey?: string): StreamingProvider[] {
  const orProvider = new OpenRouterProvider();
  if (userApiKey) orProvider.setApiKey(userApiKey);
  orProvider.available = !!(userApiKey || orProvider["fallbackKey"]);
  return [
    new ZaiProvider(),
    orProvider,
    new GroqProvider(),
    new OllamaProvider(),
  ];
}

/* ============================================================
 * SSE stream parser — parses OpenAI-compatible text/event-stream
 * from a ReadableStream<Uint8Array> into content deltas.
 * ============================================================ */

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines.
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const eventBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        for (const line of eventBlock.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // skip non-JSON lines (keepalive comments, etc.)
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
