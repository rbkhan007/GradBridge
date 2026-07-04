// Convert raw Prisma rows (with JSON-encoded string fields) into typed shapes.
import type {
  AgentId,
  AgentMode,
  ChatMessage,
  Conversation,
  KnowledgeEntry,
  ProjectFile,
  UserProfile,
} from "./types";

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function toProfile(p: {
  id: string;
  name: string;
  university: string;
  major: string;
  graduationYear: number;
  targetRole: string;
  experienceLevel: string;
  skills: string;
  goals: string;
}): UserProfile {
  return {
    id: p.id,
    name: p.name,
    university: p.university,
    major: p.major,
    graduationYear: p.graduationYear,
    targetRole: p.targetRole,
    experienceLevel: p.experienceLevel,
    skills: parseJsonArray(p.skills),
    goals: parseJsonArray(p.goals),
  };
}

export function toFile(f: {
  id: string;
  path: string;
  language: string;
  content: string;
  status: string;
  indexedAt: Date;
}): ProjectFile {
  return {
    id: f.id,
    path: f.path,
    language: f.language,
    content: f.content,
    status: (["clean", "modified", "added", "untracked"].includes(f.status)
      ? f.status
      : "clean") as ProjectFile["status"],
    indexedAt: f.indexedAt.toISOString(),
  };
}

const VALID_CATEGORIES = ["roadmap", "interview", "best-practice", "career", "system-design"];
const VALID_MODES = ["chat", "plan", "build", "debug", "optimize", "career"];
const VALID_AGENTS = ["plan", "build", "coder", "reviewer", "debugger", "optimizer", "mentor"];

export function toKnowledge(k: {
  id: string;
  title: string;
  category: string;
  tags: string;
  content: string;
  source: string;
}): KnowledgeEntry {
  return {
    id: k.id,
    title: k.title,
    category: (VALID_CATEGORIES.includes(k.category)
      ? k.category
      : "best-practice") as KnowledgeEntry["category"],
    tags: parseJsonArray(k.tags),
    content: k.content,
    source: k.source,
  };
}

export function toMessage(m: {
  id: string;
  role: string;
  content: string;
  agentMode: string | null;
  agentId: string | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: m.id,
    role: (m.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
    content: m.content,
    agentMode: (m.agentMode && VALID_MODES.includes(m.agentMode)
      ? m.agentMode
      : undefined) as ChatMessage["agentMode"],
    agentId: (m.agentId && VALID_AGENTS.includes(m.agentId)
      ? m.agentId
      : undefined) as ChatMessage["agentId"],
    createdAt: m.createdAt.toISOString(),
  };
}

export function toConversation(
  c: {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messages: {
      id: string;
      role: string;
      content: string;
      agentMode: string | null;
      agentId: string | null;
      createdAt: Date;
    }[];
  },
): Conversation {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messages: c.messages.map(toMessage),
  };
}
