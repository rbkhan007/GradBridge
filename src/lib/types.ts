export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type AgentMode =
  | "chat"
  | "plan"
  | "build"
  | "debug"
  | "optimize"
  | "career";

export type AgentId =
  | "plan"
  | "build"
  | "coder"
  | "reviewer"
  | "debugger"
  | "optimizer"
  | "mentor";

export type AgentTaskStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "timeout";

export type UserRole = "user" | "admin" | "moderator";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  icon: string;
  accent: string;
  systemPrompt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentMode?: AgentMode;
  agentId?: AgentId;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface UserProfile {
  id: string;
  name: string;
  university: string;
  major: string;
  graduationYear: number;
  targetRole: string;
  experienceLevel: string;
  skills: string[];
  goals: string[];
}

export interface ProjectFile {
  id: string;
  path: string;
  language: string;
  content: string;
  status: "clean" | "modified" | "added" | "untracked";
  indexedAt: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: "roadmap" | "interview" | "best-practice" | "career" | "system-design";
  tags: string[];
  content: string;
  source: string;
}

export interface Plan {
  id: string;
  title: string;
  goal: string;
  content: string;
  status: "draft" | "approved" | "applied";
  createdAt: string;
}

export interface RagResult {
  type: "file" | "knowledge";
  id: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
}

export interface ChatRequest {
  message: string;
  mode: AgentMode;
  agentId?: AgentId;
  conversationId?: string;
  profile?: UserProfile;
  context?: {
    activeFilePath?: string;
    ragResults?: RagResult[];
  };
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  ragResults: RagResult[];
  tokensUsed: number;
}

export interface DiffRequest {
  filePath: string;
  instruction: string;
}

export interface DiffResponse {
  filePath: string;
  language: string;
  original: string;
  proposed: string;
  diff: string;
  summary: string;
  approved: boolean;
}

export interface AgentRun {
  id: string;
  mode: AgentMode;
  agentId: AgentId;
  prompt: string;
  result: string;
  tokensUsed: number;
  status: "success" | "failed" | "timeout";
  createdAt: string;
}

export interface AgentTask {
  id: string;
  mode: AgentMode;
  agentId: AgentId;
  prompt: string;
  result: string;
  status: AgentTaskStatus;
  retryCount: number;
  maxRetries: number;
  tokensUsed: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillAudit {
  id: string;
  userId: string;
  skill: string;
  category: "technical" | "soft" | "career";
  score: number;
  evidence: string;
  notes: string;
  auditedAt: string;
}

export interface VectorEmbedding {
  id: string;
  userId: string;
  sourceType: "knowledge" | "file" | "conversation";
  sourceId: string;
  content: string;
  embedding?: number[];
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed";
  createdAt: string;
}
