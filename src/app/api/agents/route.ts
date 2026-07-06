// GET /api/agents — list all sub-agents, modes, and configured LLM providers.
import { NextResponse } from "next/server";
import { AGENT_LIST, MODE_META } from "@/lib/agents";
import { listProviders } from "@/lib/llm";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  return NextResponse.json({
    agents: AGENT_LIST,
    modes: MODE_META,
    providers: listProviders(),
  });
}
