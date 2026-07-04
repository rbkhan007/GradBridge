// GET /api/agents — list all sub-agents, modes, and configured LLM providers.
import { NextResponse } from "next/server";
import { AGENT_LIST, MODE_META } from "@/lib/agents";
import { listProviders } from "@/lib/llm";
import { requireUser, HttpError } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireUser(req);
    return NextResponse.json({
      agents: AGENT_LIST,
      modes: MODE_META,
      providers: listProviders(),
    });
  } catch (err) {
    if (err instanceof HttpError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}
