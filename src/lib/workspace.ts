// Per-user workspace initialization.
// Each user gets their own copy of the demo project files (cloned from
// FileTemplate) on first access. This isolates file edits per user.
import { db } from "./db";

/**
 * Ensure the user has a workspace. If they have no ProjectFile rows yet,
 * clone all FileTemplates into their workspace. Returns the user's files.
 */
export async function ensureWorkspace(userId: string) {
  const existing = await db.projectFile.findMany({
    where: { userId },
    orderBy: { path: "asc" },
  });

  if (existing.length > 0) return existing;

  // Clone templates into the user's workspace.
  const templates = await db.fileTemplate.findMany({ orderBy: { path: "asc" } });
  if (templates.length === 0) return [];

  await db.projectFile.createMany({
    data: templates.map((t) => ({
      userId,
      path: t.path,
      language: t.language,
      content: t.content,
      status: "clean",
    })),
  });

  return db.projectFile.findMany({
    where: { userId },
    orderBy: { path: "asc" },
  });
}
