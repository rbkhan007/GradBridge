import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dispatchWebhook } from "@/lib/webhooks";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { query, resultsJson, helpfulResultIds, feedback, agentMode, agentId }: {
    query?: string; resultsJson?: string[]; helpfulResultIds?: string[]; feedback?: string; agentMode?: string; agentId?: string;
  } = await req.json().catch(() => ({}));

  if (!query || !feedback) {
    return NextResponse.json({ error: "query and feedback are required" }, { status: 400 });
  }

  const validFeedback = ["helpful", "not_helpful", "partial"];
  if (!validFeedback.includes(feedback)) {
    return NextResponse.json({ error: `feedback must be one of: ${validFeedback.join(", ")}` }, { status: 400 });
  }

  const record = await db.ragFeedback.create({
    data: {
      userId: user.id,
      query,
      resultsJson: JSON.stringify(resultsJson ?? []),
      helpfulResultIds: JSON.stringify(helpfulResultIds ?? []),
      feedback,
      agentMode: agentMode ?? "chat",
      agentId: agentId ?? "coder",
    },
  });

  dispatchWebhook(user.id, "rag_feedback.created", { feedbackId: record.id, query, feedback }).catch(() => {});
  return NextResponse.json({ feedback: record }, { status: 201 });
}
