// POST /api/files/diff — generate a proposed file edit + unified diff (user-scoped).
// Returns the original, proposed content, and a line diff for the user to
// approve. Does NOT write to disk until explicitly approved via /api/files/apply.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGENTS } from "@/lib/agents";
import { runCompletion, type ChatTurn } from "@/lib/llm";
import { diffText } from "@/lib/diff";
import { toProfile } from "@/lib/serializers";
import { requireUser } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractCodeBlock(text: string): string {
  const fence = text.match(/```[^\n]*\n([\s\S]*?)```/);
  if (fence) return fence[1].replace(/\n$/, "");
  return text;
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  let body: { filePath?: string; instruction?: string };
  try {
    body = (await req.json()) as { filePath?: string; instruction?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { filePath, instruction } = body;

  if (!filePath || !instruction?.trim()) {
    return NextResponse.json(
      { error: "filePath and instruction are required" },
      { status: 400 },
    );
  }
  if (instruction.length > 4000) {
    return NextResponse.json(
      { error: "instruction too long (max 4000 chars)" },
      { status: 413 },
    );
  }

  await ensureWorkspace(user.id);
  const file = await db.projectFile.findFirst({
    where: { userId: user.id, path: filePath },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const profileRow =
    (await db.userProfile.findUnique({ where: { userId: user.id } })) ??
    (await db.userProfile.create({ data: { userId: user.id, name: user.name } }));
  const profile = toProfile(profileRow);

  const systemPrompt = `${AGENTS.build.systemPrompt}

You are editing the file \`${file.path}\` (language: ${file.language}).
Apply the user's instruction with a MINIMAL, surgical edit. Output ONLY the
complete new file content inside a single fenced code block whose info string
is \`${file.language} ${file.path}\`. Do not add commentary outside the block.`;

  const turns: ChatTurn[] = [
    {
      role: "system",
      content: `${systemPrompt}\n\n---\n\n## Learner Profile\n- ${profile.name} · ${profile.targetRole} · ${profile.experienceLevel}`,
    },
    {
      role: "user",
      content: `Current content of \`${file.path}\`:\n\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\nInstruction: ${instruction}`,
    },
  ];

  const result = await runCompletion(turns, { retries: 1 });
  const proposed = extractCodeBlock(result.content);
  const diff = diffText(file.content, proposed);

  const summary =
    diff.added === 0 && diff.removed === 0
      ? "No changes detected."
      : `${diff.added} line${diff.added === 1 ? "" : "s"} added · ${diff.removed} line${diff.removed === 1 ? "" : "s"} removed`;

  return NextResponse.json({
    filePath: file.path,
    language: file.language,
    original: file.content,
    proposed,
    diff: diff.text,
    summary,
    approved: false,
  });
}
