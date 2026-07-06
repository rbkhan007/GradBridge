//! GradBridge CLI — the bridge from CS graduation to shipped.
//!
//! The CLI is a thin client that talks to a running GradBridge web app
//! (Next.js) for all LLM + data operations. It never calls LLMs directly
//! (the web app is the backend). Authentication uses the same `gb_session`
//! cookie the web app's login flow issues.
//!
//! # Commands
//! ```text
//! gradbridge login                          authenticate against the web app
//! gradbridge logout                         clear the local session
//! gradbridge whoami                         show the current user
//! gradbridge chat "prompt"                  one-shot chat (Chat mode)
//! gradbridge plan "goal"                    Plan agent → structured plan
//! gradbridge debug "file path"              debug a file (Debug mode)
//! gradbridge optimize "query"               Optimize mode
//! gradbridge career "query"                 Career Mentor mode
//! gradbridge tui                            launch the interactive TUI
//! gradbridge files                          list indexed project files
//! gradbridge knowledge "query"              search the knowledge base
//! gradbridge memory                         show your career profile
//! gradbridge rag reindex                    rebuild the local RAG index
//! gradbridge rag search "query"             search the local RAG index
//! ```
//!
//! # Config
//! Lives at `~/.gradbridge/config.toml`. Set the web app URL with
//! `--api-base` or by editing the file.

use std::io::{self, Write};
use std::path::PathBuf;

use anyhow::{anyhow, bail, Context, Result};
use clap::{Parser, Subcommand};
use colored::Colorize;

mod agents;
mod api;
mod config;
mod diff;
mod local;
mod rag;
mod tui;

use agents::{AgentId, AgentMode};
use api::GradBridgeApi;
use config::Config;

// ---------------------------------------------------------------------------
// CLI definition (clap derive)
// ---------------------------------------------------------------------------

#[derive(Parser, Debug)]
#[command(
    name = "gradbridge",
    version,
    about = "GradBridge — the bridge from CS graduation to shipped.",
    long_about = "An OpenCode-style autonomous agent CLI. Talks to a running GradBridge web app for LLM + data."
)]
struct Cli {
    /// Override the web app base URL (default: http://localhost:3000).
    #[arg(long, global = true, env = "GRADBRIDGE_API_BASE")]
    api_base: Option<String>,

    /// Run in local-first mode (direct Ollama + offline RAG, no web backend).
    #[arg(long, global = true)]
    local: bool,

    /// Suppress colored output.
    #[arg(long, global = true)]
    no_color: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Authenticate against the web app (sets the gb_session cookie).
    Login {
        /// Email (prompted if omitted).
        #[arg(long)]
        email: Option<String>,
        /// Password (prompted if omitted).
        #[arg(long)]
        password: Option<String>,
    },
    /// Clear the local session.
    Logout,
    /// Show the currently authenticated user.
    Whoami,

    /// One-shot chat (Chat mode, Coder agent by default).
    Chat {
        /// The prompt.
        message: String,
        /// Override the sub-agent (coder, reviewer, debugger, ...).
        #[arg(long)]
        agent: Option<String>,
        /// Override the mode (chat, plan, build, debug, optimize, career).
        #[arg(long)]
        mode: Option<String>,
    },
    /// Plan agent → structured markdown plan.
    Plan {
        /// The goal.
        goal: String,
    },
    /// Debug a file (reads the file locally, sends to the Debugger agent).
    Debug {
        /// Path to the file to debug.
        path: PathBuf,
    },
    /// Optimize mode (free-text query, or a file path to optimize).
    Optimize {
        /// A query, or a path to a file to optimize.
        query: String,
    },
    /// Career Mentor mode.
    Career {
        /// The career question.
        query: String,
    },

    /// Launch the interactive TUI.
    Tui,

    /// List indexed project files.
    Files,
    /// Search the knowledge base (RAG corpus).
    Knowledge {
        /// Optional search query.
        query: Option<String>,
    },
    /// Show / edit your career profile (memory).
    Memory,

    /// Local RAG index operations.
    Rag {
        #[command(subcommand)]
        action: RagAction,
    },

    /// Local-first mode operations (direct Ollama + offline RAG).
    Local {
        #[command(subcommand)]
        action: LocalAction,
    },
}

#[derive(Subcommand, Debug)]
enum LocalAction {
    /// Check if the local Ollama instance is reachable.
    Check,
    /// Set the Ollama base URL (stored in config).
    SetUrl {
        url: String,
    },
    /// Set the Ollama model (stored in config).
    SetModel {
        model: String,
    },
}

#[derive(Subcommand, Debug)]
enum RagAction {
    /// Rebuild the local RAG index from the current directory.
    Reindex {
        /// Directory to index (default: current directory).
        #[arg(long, default_value = ".")]
        dir: PathBuf,
    },
    /// Search the local RAG index.
    Search {
        query: String,
        /// Max results.
        #[arg(long, default_value_t = 5)]
        limit: usize,
    },
    /// List indexed files.
    List,
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.no_color {
        colored::control::set_override(false);
    }

    // Load config, applying the --api-base override if given.
    let mut cfg = config::load()?;
    if let Some(base) = &cli.api_base {
        cfg.api_base = base.clone();
        let _ = config::save(&cfg);
    }
    // Apply the --local flag (enables local-first mode for this invocation).
    if cli.local {
        cfg.local_mode = true;
    }

    match &cli.command {
        Command::Login { email, password } => cmd_login(&cfg, email.as_deref(), password.as_deref()).await,
        Command::Logout => cmd_logout(&cfg).await,
        Command::Whoami => cmd_whoami(&cfg).await,

        Command::Chat { message, agent, mode } => cmd_chat(&cfg, message, agent.as_deref(), mode.as_deref()).await,
        Command::Plan { goal } => cmd_plan(&cfg, goal).await,
        Command::Debug { path } => cmd_debug(&cfg, path).await,
        Command::Optimize { query } => cmd_optimize(&cfg, query).await,
        Command::Career { query } => cmd_career(&cfg, query).await,

        Command::Tui => cmd_tui(&cfg).await,

        Command::Files => cmd_files(&cfg).await,
        Command::Knowledge { query } => cmd_knowledge(&cfg, query.as_deref()).await,
        Command::Memory => cmd_memory(&cfg).await,

        Command::Rag { action } => match action {
            RagAction::Reindex { dir } => cmd_rag_reindex(dir).await,
            RagAction::Search { query, limit } => cmd_rag_search(query, *limit).await,
            RagAction::List => cmd_rag_list().await,
        },

        Command::Local { action } => match action {
            LocalAction::Check => local::check_local(&cfg).await,
            LocalAction::SetUrl { url } => {
                let _ = config::update(|c| c.ollama_url = url.clone());
                println!("{}  Ollama URL set to {}", "✓".green().bold(), url);
                Ok(())
            }
            LocalAction::SetModel { model } => {
                let _ = config::update(|c| c.ollama_model = model.clone());
                println!("{}  Ollama model set to {}", "✓".green().bold(), model);
                Ok(())
            }
        },
    }
}

// ---------------------------------------------------------------------------
// Auth commands
// ---------------------------------------------------------------------------

async fn cmd_login(cfg: &Config, email: Option<&str>, password: Option<&str>) -> Result<()> {
    let email = match email {
        Some(e) => e.to_string(),
        None => prompt("Email: ")?,
    };
    let password = match password {
        Some(p) => p.to_string(),
        None => {
            print!("Password: ");
            io::stdout().flush().ok();
            rpassword::read_password()?
        }
    };

    let api = GradBridgeApi::from_config(cfg)?;
    let (user, token) = api
        .login(&email, &password)
        .await
        .context("login failed")?;

    let _ = config::update(|c| {
        c.session_token = token;
        c.user = Some(user.clone());
    });

    println!(
        "{}  Logged in as {} <{}>",
        "✓".green().bold(),
        user.name.bold(),
        user.email
    );
    Ok(())
}

async fn cmd_logout(cfg: &Config) -> Result<()> {
    if cfg.is_authenticated() {
        let api = GradBridgeApi::from_config(cfg)?;
        // Best-effort server-side logout; ignore errors (the cookie may be expired).
        let _ = api.logout().await;
    }
    let _ = config::update(|c| {
        c.session_token.clear();
        c.user = None;
    });
    println!("{}  Logged out.", "✓".green().bold());
    Ok(())
}

async fn cmd_whoami(cfg: &Config) -> Result<()> {
    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    match api.me().await {
        Ok(user) => {
            println!("{}  {}", "●".green().bold(), user.name.bold());
            println!("    {}  ({})", user.email, user.role);
            Ok(())
        }
        Err(e) => {
            bail!("not authenticated: {:#}", e);
        }
    }
}

// ---------------------------------------------------------------------------
// Agent commands
// ---------------------------------------------------------------------------

async fn cmd_chat(
    cfg: &Config,
    message: &str,
    agent: Option<&str>,
    mode: Option<&str>,
) -> Result<()> {
    let mode = parse_mode(mode.unwrap_or("chat"))?;
    let agent_id = match agent {
        Some(a) => Some(parse_agent(a)?),
        None => None,
    };

    // Local-first mode: call Ollama directly, no auth required.
    if cfg.local_mode {
        local::run_local(cfg, message, mode, agent_id, true).await?;
        return Ok(());
    }

    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let resp = api.chat(message, mode, agent_id, None).await?;
    print_agent_reply(&resp.message, agent_id.unwrap_or_else(|| mode.default_agent()));
    if !resp.rag_results.is_empty() {
        print_rag_context(&resp.rag_results);
    }
    Ok(())
}

async fn cmd_plan(cfg: &Config, goal: &str) -> Result<()> {
    // Local-first mode.
    if cfg.local_mode {
        local::run_local(cfg, goal, AgentMode::Plan, Some(AgentId::Plan), true).await?;
        return Ok(());
    }

    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let resp = api.plan(goal).await?;

    println!(
        "\n{}  {}\n",
        "▸".cyan().bold(),
        resp.plan.title.bold()
    );
    println!("{}", resp.plan.content);
    println!("\n{}  Plan saved (status: {})", "✓".green().bold(), resp.plan.status);
    if !resp.rag_results.is_empty() {
        print_rag_context(&resp.rag_results);
    }
    Ok(())
}

async fn cmd_debug(cfg: &Config, path: &std::path::Path) -> Result<()> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read {}", path.display()))?;
    let language = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("text");
    let rel = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    let message = format!(
        "Debug this file (`{}`):\n\n```{}\n{}\n```\n\nIdentify any bugs, edge cases, or issues, and propose a minimal fix.",
        rel, language, content
    );

    // Local-first mode.
    if cfg.local_mode {
        local::run_local(cfg, &message, AgentMode::Debug, Some(AgentId::Debugger), true).await?;
        return Ok(());
    }

    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let resp = api
        .chat(&message, AgentMode::Debug, Some(AgentId::Debugger), None)
        .await?;
    print_agent_reply(&resp.message, AgentId::Debugger);
    Ok(())
}

async fn cmd_optimize(cfg: &Config, query: &str) -> Result<()> {
    // If the query is an existing file, read it + send as context.
    let message = if std::path::Path::new(query).is_file() {
        let content = std::fs::read_to_string(query)
            .with_context(|| format!("read {}", query))?;
        let language = std::path::Path::new(query)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("text");
        format!(
            "Optimize this file (`{}`):\n\n```{}\n{}\n```\n\nIdentify bottlenecks + propose an optimized version with quantified wins.",
            query, language, content
        )
    } else {
        query.to_string()
    };

    // Local-first mode.
    if cfg.local_mode {
        local::run_local(cfg, &message, AgentMode::Optimize, Some(AgentId::Optimizer), true).await?;
        return Ok(());
    }

    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let resp = api
        .chat(&message, AgentMode::Optimize, Some(AgentId::Optimizer), None)
        .await?;
    print_agent_reply(&resp.message, AgentId::Optimizer);
    Ok(())
}

async fn cmd_career(cfg: &Config, query: &str) -> Result<()> {
    // Local-first mode.
    if cfg.local_mode {
        local::run_local(cfg, query, AgentMode::Career, Some(AgentId::Mentor), true).await?;
        return Ok(());
    }

    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let resp = api
        .chat(query, AgentMode::Career, Some(AgentId::Mentor), None)
        .await?;
    print_agent_reply(&resp.message, AgentId::Mentor);
    Ok(())
}

// ---------------------------------------------------------------------------
// TUI
// ---------------------------------------------------------------------------

async fn cmd_tui(cfg: &Config) -> Result<()> {
    require_auth(cfg)?;
    let user = cfg.user.clone().ok_or_else(|| anyhow!("not authenticated — run `gradbridge login`"))?;
    let api = GradBridgeApi::from_config(cfg)?;
    let app = tui::TuiApp::new(api, user.name);
    tui::run(app).await
}

// ---------------------------------------------------------------------------
// Data commands
// ---------------------------------------------------------------------------

async fn cmd_files(cfg: &Config) -> Result<()> {
    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let files = api.files().await?;
    println!("{}  {} indexed files\n", "▸".cyan().bold(), files.len());
    for f in &files {
        let dot = match f.status.as_str() {
            "modified" => "●".yellow(),
            "added" => "◆".cyan(),
            "untracked" => "○".dimmed(),
            _ => "·".green(),
        };
        println!("  {} {}  {}", dot, f.language.dimmed(), f.path);
    }
    Ok(())
}

async fn cmd_knowledge(cfg: &Config, query: Option<&str>) -> Result<()> {
    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let entries = api.knowledge(query).await?;
    println!("{}  {} knowledge entries\n", "▸".cyan().bold(), entries.len());
    for e in &entries {
        println!("  {}  [{}] {}", e.title.bold(), e.category, e.source.dimmed());
        if !e.tags.is_empty() {
            println!("       {}", e.tags.join(", ").dimmed());
        }
    }
    Ok(())
}

async fn cmd_memory(cfg: &Config) -> Result<()> {
    require_auth(cfg)?;
    let api = GradBridgeApi::from_config(cfg)?;
    let p = api.memory().await?;
    println!("{}  Career profile (memory)\n", "▸".cyan().bold());
    println!("  Name:           {}", p.name.bold());
    println!("  University:     {}", p.university);
    println!("  Major:          {}", p.major);
    println!("  Graduation:     {}", p.graduation_year);
    println!("  Target role:    {}", p.target_role.bold());
    println!("  Experience:     {}", p.experience_level);
    if !p.skills.is_empty() {
        println!("  Skills:         {}", p.skills.join(", "));
    }
    if !p.goals.is_empty() {
        println!("  Goals:");
        for g in &p.goals {
            println!("    • {}", g);
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Local RAG commands
// ---------------------------------------------------------------------------

async fn cmd_rag_reindex(dir: &std::path::Path) -> Result<()> {
    let index = rag::RagIndex::open().await?;
    let n = index.reindex(dir).await?;
    println!("{}  Indexed {} files into the local RAG index.", "✓".green().bold(), n);
    Ok(())
}

async fn cmd_rag_search(query: &str, limit: usize) -> Result<()> {
    let index = rag::RagIndex::open().await?;
    let hits = index.search(query, limit).await?;
    if hits.is_empty() {
        println!("{}  No matches. Run `gradbridge rag reindex` first.", "▸".dimmed());
        return Ok(());
    }
    println!("{}  {} match{}\n", "▸".cyan().bold(), hits.len(), if hits.len() == 1 { "" } else { "es" });
    for h in &hits {
        println!("  {}  {}  ({:.2})", "●".green(), h.path.bold(), h.score);
        println!("     {}", h.snippet.replace('\n', "\n     ").dimmed());
        println!();
    }
    Ok(())
}

async fn cmd_rag_list() -> Result<()> {
    let index = rag::RagIndex::open().await?;
    let files = index.list().await?;
    println!("{}  {} indexed files\n", "▸".cyan().bold(), files.len());
    for (path, lang) in &files {
        println!("  {}  {}", path, lang.dimmed());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Bail if not authenticated.
fn require_auth(cfg: &Config) -> Result<()> {
    if !cfg.is_authenticated() {
        bail!("not authenticated — run `gradbridge login`");
    }
    Ok(())
}

/// Prompt the user for a line of input.
fn prompt(msg: &str) -> Result<String> {
    print!("{}", msg);
    io::stdout().flush().ok();
    let mut buf = String::new();
    io::stdin().read_line(&mut buf).context("read stdin")?;
    Ok(buf.trim().to_string())
}

/// Parse a mode string (case-insensitive).
fn parse_mode(s: &str) -> Result<AgentMode> {
    match s.to_lowercase().as_str() {
        "chat" => Ok(AgentMode::Chat),
        "plan" => Ok(AgentMode::Plan),
        "build" => Ok(AgentMode::Build),
        "debug" => Ok(AgentMode::Debug),
        "optimize" => Ok(AgentMode::Optimize),
        "career" => Ok(AgentMode::Career),
        other => bail!("unknown mode '{}' (try: chat, plan, build, debug, optimize, career)", other),
    }
}

/// Parse an agent-id string (case-insensitive).
fn parse_agent(s: &str) -> Result<AgentId> {
    match s.to_lowercase().as_str() {
        "plan" => Ok(AgentId::Plan),
        "build" => Ok(AgentId::Build),
        "coder" => Ok(AgentId::Coder),
        "reviewer" => Ok(AgentId::Reviewer),
        "debugger" => Ok(AgentId::Debugger),
        "optimizer" => Ok(AgentId::Optimizer),
        "mentor" => Ok(AgentId::Mentor),
        other => bail!("unknown agent '{}' (try: plan, build, coder, reviewer, debugger, optimizer, mentor)", other),
    }
}

/// Print an agent reply with a colored header + the markdown body.
fn print_agent_reply(msg: &api::ChatMessage, agent: AgentId) {
    let header = format!(" {} ", agent.name());
    println!("\n{} {}", header.on_color(agent_color_256(agent)).black().bold(), agent.role().dimmed());
    println!("{}", "─".repeat(60).dimmed());
    println!("{}", msg.content);
    println!();
}

/// Map an `AgentId` to a `colored::Color` (256-color) for the header background.
fn agent_color_256(a: AgentId) -> colored::Color {
    use colored::Color;
    match a {
        AgentId::Plan => Color::BrightGreen,
        AgentId::Build => Color::Yellow,
        AgentId::Coder => Color::Green,
        AgentId::Reviewer => Color::Cyan,
        AgentId::Debugger => Color::Red,
        AgentId::Optimizer => Color::Magenta,
        AgentId::Mentor => Color::BrightYellow,
    }
}

/// Print the RAG context strip (ranked knowledge / file hits).
fn print_rag_context(rag: &[api::RagResult]) {
    println!("{}", "─── Context (RAG) ───".cyan().dimmed());
    for r in rag.iter().take(5) {
        println!(
            "  {}  {}  ({:.2})",
            "•".green(),
            r.title.bold(),
            r.score
        );
        if !r.snippet.is_empty() {
            let snippet: String = r.snippet.chars().take(120).collect();
            println!("     {}", snippet.replace('\n', " ").dimmed());
        }
    }
    println!();
}
