"use client";

import { createElement } from "react";
import {
  ArrowRight,
  Bot,
  BookOpen,
  Brain,
  Bug,
  Check,
  ClipboardList,
  Code2,
  Compass,
  Cpu,
  Database,
  FileCode2,
  FileJson,
  FileSearch,
  FileText,
  FolderTree,
  Gauge,
  GitBranch,
  GraduationCap,
  Hammer,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  UserPlus,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Maps a lucide icon name string (stored on agents / modes) to the actual
 * lucide component. Falls back to Sparkles for unknown names.
 */
const ICONS: Record<string, LucideIcon> = {
  // agent + mode icons
  ClipboardList,
  Hammer,
  Code2,
  ShieldCheck,
  Bug,
  Gauge,
  GraduationCap,
  MessageSquare,
  Bot,
  FolderTree,
  BookOpen,
  Brain,
  Sparkles,
  // file type icons
  FileCode2,
  FileJson,
  FileText,
  // auth / nav / landing
  ArrowRight,
  Check,
  Compass,
  Cpu,
  Database,
  FileSearch,
  GitBranch,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Rocket,
  Terminal,
  User,
  UserPlus,
  Zap,
};

export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? Sparkles;
}

/**
 * Static component wrapper that resolves a lucide icon by name. Uses
 * createElement (rather than `const Cmp = resolveIcon(name); <Cmp />`) so the
 * react-hooks/static-components rule is satisfied — no component is created or
 * aliased during render.
 */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  return createElement(resolveIcon(name), props);
}

export type { LucideIcon };
