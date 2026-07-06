//! Agent definitions for the Rust CLI — mirrors `src/lib/agents.ts` from the
//! web app.
//!
//! 7 sub-agents (plan, build, coder, reviewer, debugger, optimizer, mentor)
//! and 6 modes (chat, plan, build, debug, optimize, career). The CLI sends
//! these IDs to the web app's `/api/chat` endpoint; the web app resolves the
//! same agent + system prompt, so behavior is identical to the dashboard.

use serde::{Deserialize, Serialize};

/// The 6 agent modes (OpenCode-style). Sent as `mode` to `/api/chat`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentMode {
    Chat,
    Plan,
    Build,
    Debug,
    Optimize,
    Career,
}

impl AgentMode {
    /// All modes, in canonical order (matches the web app's mode selector).
    pub fn all() -> &'static [AgentMode] {
        &[
            AgentMode::Chat,
            AgentMode::Plan,
            AgentMode::Build,
            AgentMode::Debug,
            AgentMode::Optimize,
            AgentMode::Career,
        ]
    }

    /// The mode's display label (e.g. "Chat", "Plan").
    pub fn label(&self) -> &'static str {
        match self {
            AgentMode::Chat => "Chat",
            AgentMode::Plan => "Plan",
            AgentMode::Build => "Build",
            AgentMode::Debug => "Debug",
            AgentMode::Optimize => "Optimize",
            AgentMode::Career => "Career",
        }
    }

    /// A short one-line description.
    pub fn description(&self) -> &'static str {
        match self {
            AgentMode::Chat => "Free-form coding help with full project + knowledge context.",
            AgentMode::Plan => "Read-only structured plan you approve before execution.",
            AgentMode::Build => "Execute approved changes with diff preview + approval.",
            AgentMode::Debug => "Diagnose errors and propose minimal fixes.",
            AgentMode::Optimize => "Performance + readability improvements, quantified.",
            AgentMode::Career => "Roadmaps, resume tips, and interview prep for fresh grads.",
        }
    }

    /// The default sub-agent for this mode (mirrors `MODE_META.defaultAgent`).
    pub fn default_agent(&self) -> AgentId {
        match self {
            AgentMode::Chat => AgentId::Coder,
            AgentMode::Plan => AgentId::Plan,
            AgentMode::Build => AgentId::Build,
            AgentMode::Debug => AgentId::Debugger,
            AgentMode::Optimize => AgentId::Optimizer,
            AgentMode::Career => AgentId::Mentor,
        }
    }

    /// Cycle to the next mode (used by the TUI `Tab` keybinding).
    pub fn next(&self) -> AgentMode {
        let all = Self::all();
        let idx = all.iter().position(|m| m == self).unwrap_or(0);
        all[(idx + 1) % all.len()]
    }

    /// The snake_case string sent to the web API.
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentMode::Chat => "chat",
            AgentMode::Plan => "plan",
            AgentMode::Build => "build",
            AgentMode::Debug => "debug",
            AgentMode::Optimize => "optimize",
            AgentMode::Career => "career",
        }
    }
}

impl std::fmt::Display for AgentMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.label())
    }
}

/// The 7 sub-agent IDs. Sent as `agentId` to `/api/chat`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentId {
    Plan,
    Build,
    Coder,
    Reviewer,
    Debugger,
    Optimizer,
    Mentor,
}

impl AgentId {
    pub fn all() -> &'static [AgentId] {
        &[
            AgentId::Plan,
            AgentId::Build,
            AgentId::Coder,
            AgentId::Reviewer,
            AgentId::Debugger,
            AgentId::Optimizer,
            AgentId::Mentor,
        ]
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            AgentId::Plan => "plan",
            AgentId::Build => "build",
            AgentId::Coder => "coder",
            AgentId::Reviewer => "reviewer",
            AgentId::Debugger => "debugger",
            AgentId::Optimizer => "optimizer",
            AgentId::Mentor => "mentor",
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            AgentId::Plan => "Plan Agent",
            AgentId::Build => "Build Agent",
            AgentId::Coder => "Coder Agent",
            AgentId::Reviewer => "Reviewer Agent",
            AgentId::Debugger => "Debugger Agent",
            AgentId::Optimizer => "Optimizer Agent",
            AgentId::Mentor => "Career Mentor",
        }
    }

    pub fn role(&self) -> &'static str {
        match self {
            AgentId::Plan => "Read-only strategist",
            AgentId::Build => "Execution",
            AgentId::Coder => "Sub-agent · Implementation",
            AgentId::Reviewer => "Sub-agent · Code review",
            AgentId::Debugger => "Sub-agent · Diagnosis",
            AgentId::Optimizer => "Sub-agent · Performance & clarity",
            AgentId::Mentor => "Sub-agent · Career guidance",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            AgentId::Plan => "Analyzes the request, reads project context via RAG, and produces \
              a structured markdown plan. Read-only — never edits files until approved.",
            AgentId::Build => "Applies approved code changes safely. Shows a diff preview for \
              every edit and waits for explicit approval before writing.",
            AgentId::Coder => "Writes clean, idiomatic implementation code from a spec. Focuses \
              on correctness and readability for a junior engineer to learn from.",
            AgentId::Reviewer => "Reviews diffs for bugs, security, style, and maintainability. \
              Outputs a prioritized findings list with severity.",
            AgentId::Debugger => "Diagnoses errors and stack traces, identifies root cause, and \
              proposes a minimal fix.",
            AgentId::Optimizer => "Improves performance, memory, and readability. Quantifies wins \
              and avoids premature optimization.",
            AgentId::Mentor => "Roadmaps, resume tips, interview prep, and growth advice tailored \
              to a fresh graduate's target role.",
        }
    }

    /// Ratatui `Color` accent for this agent (mirrors the web app's tailwind gradient).
    pub fn accent_color(&self) -> ratatui::style::Color {
        use ratatui::style::Color;
        match self {
            // emerald/teal
            AgentId::Plan => Color::Rgb(16, 185, 129),
            // amber/orange
            AgentId::Build => Color::Rgb(245, 158, 11),
            // emerald/green
            AgentId::Coder => Color::Rgb(34, 197, 94),
            // sky/cyan
            AgentId::Reviewer => Color::Rgb(14, 165, 233),
            // rose/red
            AgentId::Debugger => Color::Rgb(244, 63, 94),
            // violet/fuchsia
            AgentId::Optimizer => Color::Rgb(168, 85, 247),
            // amber/yellow
            AgentId::Mentor => Color::Rgb(234, 179, 8),
        }
    }
}

impl std::fmt::Display for AgentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.name())
    }
}

/// A full agent definition (mirrors `AgentDefinition` in `src/lib/types.ts`).
#[derive(Debug, Clone)]
pub struct AgentDefinition {
    pub id: AgentId,
    pub name: &'static str,
    pub role: &'static str,
    pub description: &'static str,
    pub system_prompt: &'static str,
}

const BASE: &str = "You are GradBridge, an autonomous AI agent for fresh Computer Science \
    & Software Engineering graduates. You are precise, encouraging, and pragmatic. You explain \
    trade-offs, not just answers. You favor modern best practices (TypeScript, clean architecture, \
    testing) and you always consider the learner's growth.\n\nOutput rules:\n- Use GitHub-flavored Markdown.\n- Use fenced code blocks with the correct language tag.\n- Keep prose tight; lead with the actionable answer.\n- When proposing file changes, show the exact code block with the file path as the info string, e.g. ```ts src/auth/login.ts.\n- For multi-step work, use numbered lists.";

macro_rules! prompt {
    ($suffix:expr) => {{
        use std::sync::LazyLock;
        static PROMPT: LazyLock<String> = LazyLock::new(|| format!("{}\n\n{}", BASE, $suffix));
        PROMPT.as_str()
    }};
}

/// System prompt for the Plan agent (read-only structured planning).
pub fn plan_prompt() -> &'static str {
    prompt!("You are operating in PLAN mode (read-only). Do NOT write or modify files. Produce a structured plan as Markdown with these sections:\n## Goal\nOne sentence describing the outcome.\n## Context\nWhat you learned from the project / RAG context (2-4 bullets).\n## Steps\nA numbered, ordered list of concrete implementation steps. Each step references the file(s) it touches.\n## Files Touched\n- `path/to/file` — what changes and why\n## Risks & Edge Cases\n2-4 bullets.\n## Acceptance Criteria\nA short checklist that proves the work is done.\nEnd by asking the user to approve the plan before the Build agent executes it.")
}

/// System prompt for the Build agent (executes approved changes).
pub fn build_prompt() -> &'static str {
    prompt!("You are operating in BUILD mode. You execute an approved plan one step at a time. For each change:\n1. State which file you are touching and why.\n2. Show the complete proposed code block with the file path in the info string.\n3. Summarize the edit in one line.\nNever silently rewrite a file — always present the full proposed content so it can be diffed. Prefer minimal, surgical edits. Add brief comments only where non-obvious.")
}

/// System prompt for the Coder sub-agent.
pub fn coder_prompt() -> &'static str {
    prompt!("You are the CODER sub-agent. Write production-quality, idiomatic code from the given spec. Include brief, helpful comments that teach a fresh graduate *why*, not just *what*. Prefer small pure functions, clear naming, and TypeScript types. Show the full file content in a fenced block with the path in the info string.")
}

/// System prompt for the Reviewer sub-agent.
pub fn reviewer_prompt() -> &'static str {
    prompt!("You are the REVIEWER sub-agent. Review the provided code/diff and produce findings as Markdown:\n## Summary\nOne line.\n## Findings\nFor each: `[SEVERITY]` (CRITICAL / HIGH / MEDIUM / LOW / NIT) — file:line — issue — suggested fix.\n## Verdict\nAPPROVE, REQUEST CHANGES, or BLOCK, with a one-line reason.\nBe precise and kind. Praise good patterns briefly.")
}

/// System prompt for the Debugger sub-agent.
pub fn debugger_prompt() -> &'static str {
    prompt!("You are the DEBUGGER sub-agent. Given an error, stack trace, or buggy code:\n## Root Cause\nThe most likely cause, in one or two sentences.\n## Evidence\nBulleted pointers to the exact lines / signals.\n## Fix\nA minimal code change in a fenced block (path in info string), plus a one-line explanation.\n## Prevention\nOne bullet on how to avoid this class of bug.")
}

/// System prompt for the Optimizer sub-agent.
pub fn optimizer_prompt() -> &'static str {
    prompt!("You are the OPTIMIZER sub-agent. Analyze the code for performance, memory, and readability. Produce:\n## Bottlenecks\nBulleted list, each with estimated impact (e.g. O(n²)→O(n)).\n## Optimized Version\nFull proposed code in a fenced block (path in info string).\n## Wins\nQuantified before/after.\n## Trade-offs\nWhat (if anything) gets worse. Never optimize blindly — justify each change.")
}

/// System prompt for the Career Mentor sub-agent.
pub fn mentor_prompt() -> &'static str {
    prompt!("You are the CAREER MENTOR sub-agent for a fresh CS/SE graduate. Give concrete, current, and kind career guidance. When giving roadmaps, structure them as phases with timeframes (e.g. \"Weeks 1-2\", \"Month 1-3\") and named resources. Tailor advice to the user's target role and experience level from their profile. Avoid generic platitudes; be specific and actionable.")
}

/// Look up an `AgentDefinition` by ID.
pub fn agent_definition(id: AgentId) -> AgentDefinition {
    match id {
        AgentId::Plan => AgentDefinition {
            id: AgentId::Plan,
            name: "Plan Agent",
            role: "Read-only strategist",
            description: AgentId::Plan.description(),
            system_prompt: plan_prompt(),
        },
        AgentId::Build => AgentDefinition {
            id: AgentId::Build,
            name: "Build Agent",
            role: "Execution",
            description: AgentId::Build.description(),
            system_prompt: build_prompt(),
        },
        AgentId::Coder => AgentDefinition {
            id: AgentId::Coder,
            name: "Coder Agent",
            role: "Sub-agent · Implementation",
            description: AgentId::Coder.description(),
            system_prompt: coder_prompt(),
        },
        AgentId::Reviewer => AgentDefinition {
            id: AgentId::Reviewer,
            name: "Reviewer Agent",
            role: "Sub-agent · Code review",
            description: AgentId::Reviewer.description(),
            system_prompt: reviewer_prompt(),
        },
        AgentId::Debugger => AgentDefinition {
            id: AgentId::Debugger,
            name: "Debugger Agent",
            role: "Sub-agent · Diagnosis",
            description: AgentId::Debugger.description(),
            system_prompt: debugger_prompt(),
        },
        AgentId::Optimizer => AgentDefinition {
            id: AgentId::Optimizer,
            name: "Optimizer Agent",
            role: "Sub-agent · Performance & clarity",
            description: AgentId::Optimizer.description(),
            system_prompt: optimizer_prompt(),
        },
        AgentId::Mentor => AgentDefinition {
            id: AgentId::Mentor,
            name: "Career Mentor",
            role: "Sub-agent · Career guidance",
            description: AgentId::Mentor.description(),
            system_prompt: mentor_prompt(),
        },
    }
}

/// Resolve which agent a mode should use, allowing an explicit override.
/// (Mirrors `resolveAgent(mode, override)` in `src/lib/agents.ts`.)
pub fn resolve_agent(mode: AgentMode, override_id: Option<AgentId>) -> AgentId {
    override_id.unwrap_or_else(|| mode.default_agent())
}
