// Zustand client store for GradBridge (multi-user edition).
// Holds UI state + cached server state, with localStorage persistence for the
// active view, active mode, and active file. Auth state is NOT persisted — it
// is resolved on every mount via GET /api/auth/me using the httpOnly cookie.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AgentId,
  AgentMode,
  AuthUser,
  ChatMessage,
  ProjectFile,
  RagResult,
  UserProfile,
} from "./types";

export type View =
  | "chat"
  | "agents"
  | "files"
  | "knowledge"
  | "memory"
  | "guide"
  | "settings";

/** Top-level route (what the single `/` page renders). */
export type Route = "landing" | "login" | "register" | "guide" | "about" | "app";

interface GradBridgeState {
  // auth + top-level routing
  authUser: AuthUser | null;
  authReady: boolean; // false until /api/auth/me resolves on mount
  route: Route;
  setAuthUser: (u: AuthUser | null) => void;
  setAuthReady: (b: boolean) => void;
  setRoute: (r: Route) => void;

  // dashboard navigation
  view: View;
  setView: (v: View) => void;

  // chat
  mode: AgentMode;
  agentId: AgentId | undefined;
  setMode: (m: AgentMode) => void;
  setAgentId: (a: AgentId | undefined) => void;

  conversationId: string | null;
  messages: ChatMessage[];
  isThinking: boolean;
  lastRag: RagResult[];
  setConversation: (id: string | null) => void;
  addMessage: (m: ChatMessage) => void;
  setMessages: (m: ChatMessage[]) => void;
  setThinking: (b: boolean) => void;
  setLastRag: (r: RagResult[]) => void;
  clearChat: () => void;

  // files
  files: ProjectFile[];
  activeFilePath: string | null;
  setFiles: (f: ProjectFile[]) => void;
  setActiveFilePath: (p: string | null) => void;

  // profile
  profile: UserProfile | null;
  setProfile: (p: UserProfile | null) => void;

  // pending diff for approval
  pendingDiff: {
    filePath: string;
    language: string;
    original: string;
    proposed: string;
    diff: string;
    summary: string;
  } | null;
  setPendingDiff: (d: GradBridgeState["pendingDiff"]) => void;

  // sidebar collapse (mobile)
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
}

export const useGradBridge = create<GradBridgeState>()(
  persist(
    (set) => ({
      authUser: null,
      authReady: false,
      route: "landing",
      setAuthUser: (authUser) => set({ authUser }),
      setAuthReady: (authReady) => set({ authReady }),
      setRoute: (route) => set({ route }),

      view: "chat",
      setView: (view) => set({ view }),

      mode: "chat",
      agentId: undefined,
      setMode: (mode) => set({ mode }),
      setAgentId: (agentId) => set({ agentId }),

      conversationId: null,
      messages: [],
      isThinking: false,
      lastRag: [],
      setConversation: (conversationId) =>
        set({ conversationId }),
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      setMessages: (messages) => set({ messages }),
      setThinking: (isThinking) => set({ isThinking }),
      setLastRag: (lastRag) => set({ lastRag }),
      clearChat: () =>
        set({ messages: [], conversationId: null, lastRag: [] }),

      files: [],
      activeFilePath: null,
      setFiles: (files) => set({ files }),
      setActiveFilePath: (activeFilePath) => set({ activeFilePath }),

      profile: null,
      setProfile: (profile) => set({ profile }),

      pendingDiff: null,
      setPendingDiff: (pendingDiff) => set({ pendingDiff }),

      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "gradbridge-store",
      // Only persist dashboard prefs — never auth state (cookie is the source of truth).
      partialize: (s) => ({
        view: s.view,
        mode: s.mode,
        activeFilePath: s.activeFilePath,
      }),
    },
  ),
);
