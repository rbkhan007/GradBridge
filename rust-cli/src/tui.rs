//! Interactive TUI for GradBridge, built on `ratatui` + `crossterm`.
//!
//! Layout:
//! ```text
//! ┌──────────────────────────────────────────────────────────────┐
//! │  TopBar:  GradBridge  ·  [Chat] Plan Build Debug Opt Career  │
//! ├────────────┬─────────────────────────────────────────────────┤
//! │  Sidebar   │  Messages (scrollable)                          │
//! │  Modes     │  ┌ user                                       ┐  │
//! │  - Chat    │  │ ...                                        │  │
//! │  - Plan    │  └────────────────────────────────────────────┘  │
//! │  - Build   │  ┌ assistant (Coder) ─────────────────────────┐  │
//! │  ...       │  │ ## Root Cause                               │  │
//! │            │  │ The cookie isn't being set on the response.│  │
//! │  Files     │  └────────────────────────────────────────────┘  │
//! │  · README  │                                                   │
//! │  · src/... │                                                   │
//! ├────────────┴─────────────────────────────────────────────────┤
//! │  Status: ● authenticated · mode Chat · agent Coder · 1.2k tok │
//! ├──────────────────────────────────────────────────────────────┤
//! │  > type a message... (Enter=send  Shift+Enter=newline)       │
//! └──────────────────────────────────────────────────────────────┘
//! ```
//!
//! Keybindings:
//!   Enter        send (or newline if Shift is held)
//!   Tab          cycle to next mode
//!   Shift+Tab    previous mode
//!   c            clear conversation
//!   r            refresh file list from the web app
//!   ?            toggle help overlay
//!   q / Ctrl+C   quit
//!
//! Streaming: when a message is sent, the assistant reply is streamed in
//! real-time via `/api/chat/stream` (SSE) with a spinner while waiting for the
//! first token. Falls back to non-streaming `/api/chat` if the stream endpoint
//! is unavailable.
//!
//! Terminal hygiene: enters raw mode + the alternate screen on start and
//! restores the original terminal state on exit via a `Drop` guard (so a panic
//! never leaves the terminal broken).

use std::io::{self, Stdout};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use crossterm::event::{Event, EventStream, KeyCode, KeyEventKind, KeyModifiers};
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use crossterm::ExecutableCommand;
use futures::StreamExt;
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, List, ListItem, Paragraph, Wrap};
use ratatui::Frame;
use tokio::sync::mpsc;

use crate::agents::{AgentId, AgentMode};
use crate::api::{ChatMessage, GradBridgeApi, ProjectFile, RagResult};

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

/// A rendered chat message (user or assistant) with its agent metadata.
#[derive(Debug, Clone)]
pub struct DisplayMessage {
    pub role: String, // "user" | "assistant"
    pub content: String,
    pub agent_mode: Option<AgentMode>,
    pub agent_id: Option<AgentId>,
    pub streaming: bool,
}

/// The full TUI application state.
pub struct TuiApp {
    pub api: GradBridgeApi,
    pub user_name: String,

    pub messages: Vec<DisplayMessage>,
    pub mode: AgentMode,
    pub agent_override: Option<AgentId>,

    /// Multi-line input buffer + cursor (row, col).
    pub input: String,
    pub input_cursor: (usize, usize),

    /// Files fetched from /api/files (for the sidebar).
    pub files: Vec<ProjectFile>,
    pub files_loading: bool,

    /// Set by the 'r' key — the main loop awaits `refresh_files()` when true.
    pub pending_refresh: bool,

    /// Last RAG context shown for the most recent assistant message.
    pub last_rag: Vec<RagResult>,

    /// Cumulative token count across this session.
    pub tokens_used: i64,

    /// True while waiting for the first stream chunk.
    pub streaming: bool,
    pub spinner_tick: usize,

    pub scroll: u16,
    pub show_help: bool,

    /// Set by `stage_send` — the main loop creates the channel + spawns the
    /// streaming task, and owns the receiver locally (see `run()`). Keeping
    /// the receiver OUT of `TuiApp` lets the select! handler freely take
    /// `&mut app` without a borrow conflict.
    pub pending_send: Option<String>,
    pub conversation_id: Option<String>,
}

/// Events sent from the background streaming task to the TUI loop.
pub enum StreamEvent {
    Chunk(String),
    Done {
        message: ChatMessage,
        rag: Vec<RagResult>,
        tokens: i64,
        conversation_id: String,
    },
    Error(String),
}

impl TuiApp {
    pub fn new(api: GradBridgeApi, user_name: String) -> Self {
        Self {
            api,
            user_name,
            messages: Vec::new(),
            mode: AgentMode::Chat,
            agent_override: None,
            input: String::new(),
            input_cursor: (0, 0),
            files: Vec::new(),
            files_loading: false,
            pending_refresh: false,
            last_rag: Vec::new(),
            tokens_used: 0,
            streaming: false,
            spinner_tick: 0,
            scroll: 0,
            show_help: false,
            pending_send: None,
            conversation_id: None,
        }
    }

    /// The active agent for the current mode (override or default).
    pub fn active_agent(&self) -> AgentId {
        self.agent_override.unwrap_or_else(|| self.mode.default_agent())
    }

    /// Stage a send: push the user message, clear the input, set the streaming
    /// flag, and store the trimmed text in `pending_send`. The main loop owns
    /// the streaming channel + task (see `run()`), so this does NOT spawn.
    pub fn stage_send(&mut self) {
        let text = self.input.trim().to_string();
        if text.is_empty() || self.streaming {
            return;
        }
        // Push the user message immediately (optimistic).
        self.messages.push(DisplayMessage {
            role: "user".into(),
            content: text.clone(),
            agent_mode: Some(self.mode),
            agent_id: None,
            streaming: false,
        });
        self.input.clear();
        self.input_cursor = (0, 0);
        self.streaming = true;
        self.spinner_tick = 0;
        self.pending_send = Some(text);
    }

    pub fn clear_conversation(&mut self) {
        self.messages.clear();
        self.last_rag.clear();
        self.tokens_used = 0;
        self.conversation_id = None;
        self.scroll = 0;
    }

    /// Refresh the file list from the web app.
    pub async fn refresh_files(&mut self) {
        self.files_loading = true;
        match self.api.files().await {
            Ok(files) => self.files = files,
            Err(e) => {
                // Best-effort: surface the error in the message list.
                self.messages.push(DisplayMessage {
                    role: "assistant".into(),
                    content: format!("⚠️ Failed to refresh files: `{}`", e),
                    agent_mode: None,
                    agent_id: None,
                    streaming: false,
                });
            }
        }
        self.files_loading = false;
    }
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/// Run a streaming chat request, forwarding chunks + the final message to `tx`.
async fn stream_chat(
    api: &GradBridgeApi,
    message: &str,
    mode: AgentMode,
    agent: AgentId,
    conversation_id: Option<&str>,
    tx: mpsc::Sender<StreamEvent>,
) {
    // Use the streaming endpoint (with built-in fallback to /api/chat).
    let stream = match api.chat_stream(message, mode, Some(agent), conversation_id).await {
        Ok(s) => s,
        Err(e) => {
            let _ = tx.send(StreamEvent::Error(format!("{:#}", e))).await;
            return;
        }
    };

    tokio::pin!(stream);
    let mut accumulated = String::new();
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(text) => {
                accumulated.push_str(&text);
                let _ = tx.send(StreamEvent::Chunk(text)).await;
            }
            Err(e) => {
                let _ = tx.send(StreamEvent::Error(format!("{:#}", e))).await;
                return;
            }
        }
    }

    // The streaming endpoint (when available) returns SSE deltas. We've
    // accumulated them into `accumulated`. To get the persisted ChatMessage +
    // RAG context + token count, we DON'T have a separate "finalize" call in
    // the current web API — so we synthesize a ChatMessage locally.
    //
    // When the web app ships `/api/chat/stream` with a final `done` event
    // carrying the persisted message, this code will be updated to parse it.
    let synthetic = ChatMessage {
        id: format!("stream-{}", chrono::Utc::now().timestamp_millis()),
        role: "assistant".into(),
        content: accumulated,
        agent_mode: Some(mode.as_str().into()),
        agent_id: Some(agent.as_str().into()),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    let _ = tx
        .send(StreamEvent::Done {
            message: synthetic,
            rag: Vec::new(),
            tokens: 0,
            conversation_id: conversation_id.unwrap_or("").to_string(),
        })
        .await;
}

// ---------------------------------------------------------------------------
// Terminal guard
// ---------------------------------------------------------------------------

/// RAII guard that sets up the terminal on construction and restores it on
/// drop — so a panic never leaves the user in a broken raw-mode terminal.
pub struct TerminalGuard {
    terminal: ratatui::Terminal<CrosstermBackend<Stdout>>,
}

impl TerminalGuard {
    pub fn enter() -> Result<Self> {
        enable_raw_mode().context("enable raw mode")?;
        let mut stdout = io::stdout();
        stdout
            .execute(EnterAlternateScreen)
            .context("enter alternate screen")?;
        let backend = CrosstermBackend::new(stdout);
        let terminal = ratatui::Terminal::new(backend).context("create terminal")?;
        Ok(Self { terminal })
    }

    pub fn draw<F>(&mut self, f: F) -> Result<()>
    where
        F: FnOnce(&mut Frame),
    {
        self.terminal.draw(f).map(|_| ()).context("draw frame")
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
        let _ = io::stdout().execute(LeaveAlternateScreen);
    }
}

// ---------------------------------------------------------------------------
// Main TUI loop
// ---------------------------------------------------------------------------

/// Run the interactive TUI. Returns when the user quits (q / Ctrl+C).
pub async fn run(mut app: TuiApp) -> Result<()> {
    let mut guard = TerminalGuard::enter()?;
    let mut events = EventStream::new();
    let handle = tokio::runtime::Handle::current();

    // Kick off an initial file refresh.
    app.refresh_files().await;

    let spinner_frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinner_interval = Duration::from_millis(80);
    let mut last_spinner = Instant::now();

    // The streaming receiver lives HERE (a local), not in `app`. This is
    // deliberate: `recv()` borrows `&mut self`, and keeping the receiver out
    // of `app` lets the select! handler freely take `&mut app` without a
    // borrow conflict.
    let mut stream_rx: Option<mpsc::Receiver<StreamEvent>> = None;

    loop {
        // Draw the current frame.
        guard.draw(|frame| draw(frame, &app))?;

        // 1. Process a staged send → create the channel + spawn the stream task.
        if let Some(text) = app.pending_send.take() {
            let (tx, rx) = mpsc::channel::<StreamEvent>(64);
            let api = app.api.clone();
            let mode = app.mode;
            let agent = app.active_agent();
            let conversation_id = app.conversation_id.clone();
            handle.spawn(async move {
                stream_chat(&api, &text, mode, agent, conversation_id.as_deref(), tx).await;
            });
            // Replace any drained receiver with the fresh one.
            stream_rx = Some(rx);
        }

        // 2. Process a pending file refresh requested by the 'r' key.
        if app.pending_refresh {
            app.pending_refresh = false;
            app.refresh_files().await;
        }

        // Borrow the receiver (if any) for the select! branch future. The
        // borrow is of the LOCAL `stream_rx`, not of `app`, so handlers can
        // safely take `&mut app`.
        let mut sr = stream_rx.as_mut();

        tokio::select! {
            biased;

            // 1. Stream chunks (highest priority — feels responsive).
            maybe_evt = async {
                match &mut sr {
                    Some(rx) => rx.recv().await,
                    // No active stream — park forever (this branch never wins).
                    None => std::future::pending::<Option<StreamEvent>>().await,
                }
            } => {
                if let Some(evt) = maybe_evt {
                    handle_stream_event(&mut app, evt);
                }
                // If maybe_evt was None, the sender was dropped (stream done).
                // A drained `Receiver::recv()` returns None forever, so we can
                // leave `stream_rx` as-is — it just won't fire again.
            }

            // 2. Terminal events (keyboard, resize).
            maybe_event = events.next() => {
                let Some(event_result) = maybe_event else { break };
                let event = event_result.context("read terminal event")?;
                if !handle_event(&mut app, event) {
                    break; // q / Ctrl+C
                }
            }

            // 3. Spinner tick (only while streaming).
            _ = tokio::time::sleep(spinner_interval), if app.streaming => {
                if last_spinner.elapsed() >= spinner_interval {
                    app.spinner_tick = (app.spinner_tick + 1) % spinner_frames.len();
                    last_spinner = Instant::now();
                }
            }
        }
    }
}

/// Apply a `StreamEvent` to the app state.
fn handle_stream_event(app: &mut TuiApp, evt: StreamEvent) {
    match evt {
        StreamEvent::Chunk(text) => {
            // Append to the in-flight assistant message (or create it).
            if let Some(last) = app.messages.last_mut() {
                if last.role == "assistant" && last.streaming {
                    last.content.push_str(&text);
                    return;
                }
            }
            app.messages.push(DisplayMessage {
                role: "assistant".into(),
                content: text,
                agent_mode: Some(app.mode),
                agent_id: Some(app.active_agent()),
                streaming: true,
            });
        }
        StreamEvent::Done {
            message,
            rag,
            tokens,
            conversation_id,
        } => {
            // Finalize the in-flight message.
            if let Some(last) = app.messages.last_mut() {
                if last.role == "assistant" && last.streaming {
                    last.content = message.content;
                    last.streaming = false;
                } else {
                    app.messages.push(DisplayMessage {
                        role: "assistant".into(),
                        content: message.content,
                        agent_mode: Some(app.mode),
                        agent_id: Some(app.active_agent()),
                        streaming: false,
                    });
                }
            }
            app.streaming = false;
            app.last_rag = rag;
            app.tokens_used += tokens;
            if !conversation_id.is_empty() {
                app.conversation_id = Some(conversation_id);
            }
            // The sender is dropped after Done — `recv()` will return None on
            // the next poll, so the stream branch simply stops firing.
        }
        StreamEvent::Error(msg) => {
            app.streaming = false;
            app.messages.push(DisplayMessage {
                role: "assistant".into(),
                content: format!("⚠️ **Error:** {}", msg),
                agent_mode: Some(app.mode),
                agent_id: Some(app.active_agent()),
                streaming: false,
            });
        }
    }
}

/// Handle a terminal event. Returns `false` to quit.
fn handle_event(app: &mut TuiApp, event: Event) -> bool {
    match event {
        Event::Key(key) => handle_key(app, key),
        Event::Resize(_, _) => true, // ratatui auto-handles resize on the next draw.
        _ => true,
    }
}

fn handle_key(app: &mut TuiApp, key: crossterm::event::KeyEvent) -> bool {
    // Only respond to key PRESS events (some terminals send Release/Repeat).
    if key.kind != KeyEventKind::Press {
        return true;
    }

    // Global keybindings.
    match (key.modifiers, key.code) {
        (KeyModifiers::CONTROL, KeyCode::Char('c')) => return false,
        (_, KeyCode::Char('q')) => return false,
        (_, KeyCode::Tab) => {
            app.mode = app.mode.next();
            app.agent_override = None;
            return true;
        }
        (KeyModifiers::SHIFT, KeyCode::BackTab) => {
            let all = AgentMode::all();
            let idx = all.iter().position(|m| *m == app.mode).unwrap_or(0);
            app.mode = all[(idx + all.len() - 1) % all.len()];
            app.agent_override = None;
            return true;
        }
        (_, KeyCode::Char('?')) => {
            app.show_help = !app.show_help;
            return true;
        }
        (_, KeyCode::Char('c')) if app.input.is_empty() => {
            app.clear_conversation();
            return true;
        }
        (_, KeyCode::Char('r')) if app.input.is_empty() => {
            // Defer the async refresh to the main loop.
            app.pending_refresh = true;
            return true;
        }
        _ => {}
    }

    // Input editing (disabled while streaming).
    if app.streaming {
        return true;
    }
    match key.code {
        KeyCode::Enter => {
            if key.modifiers.contains(KeyModifiers::SHIFT) {
                insert_newline(app);
            } else {
                app.stage_send();
            }
        }
        KeyCode::Char(c) => insert_char(app, c),
        KeyCode::Backspace => backspace(app),
        KeyCode::Delete => delete(app),
        KeyCode::Left => move_cursor_left(app),
        KeyCode::Right => move_cursor_right(app),
        KeyCode::Up => move_cursor_up(app),
        KeyCode::Down => move_cursor_down(app),
        KeyCode::Home => move_cursor_line_start(app),
        KeyCode::End => move_cursor_line_end(app),
        _ => {}
    }
    true
}

// --- Tiny input editor (multi-line, (row, col) cursor) ---

fn insert_char(app: &mut TuiApp, c: char) {
    let (row, col) = app.input_cursor;
    let mut lines: Vec<String> = app.input.split('\n').map(|s| s.to_string()).collect();
    if row < lines.len() {
        lines[row].insert(col, c);
    }
    app.input = lines.join("\n");
    app.input_cursor = (row, col + 1);
}

fn insert_newline(app: &mut TuiApp) {
    let (row, col) = app.input_cursor;
    let mut lines: Vec<String> = app.input.split('\n').map(|s| s.to_string()).collect();
    if row < lines.len() {
        let rest: String = lines[row].drain(col..).collect();
        lines.insert(row + 1, rest);
    } else {
        lines.push(String::new());
    }
    app.input = lines.join("\n");
    app.input_cursor = (row + 1, 0);
}

fn backspace(app: &mut TuiApp) {
    let (row, col) = app.input_cursor;
    if col == 0 {
        if row == 0 {
            return;
        }
        let mut lines: Vec<String> = app.input.split('\n').map(|s| s.to_string()).collect();
        let cur = lines.remove(row);
        let prev_len = lines[row - 1].len();
        lines[row - 1].push_str(&cur);
        app.input = lines.join("\n");
        app.input_cursor = (row - 1, prev_len);
    } else {
        let mut lines: Vec<String> = app.input.split('\n').map(|s| s.to_string()).collect();
        if row < lines.len() {
            lines[row].remove(col - 1);
        }
        app.input = lines.join("\n");
        app.input_cursor = (row, col - 1);
    }
}

fn delete(app: &mut TuiApp) {
    let (row, col) = app.input_cursor;
    let mut lines: Vec<String> = app.input.split('\n').map(|s| s.to_string()).collect();
    if row >= lines.len() {
        return;
    }
    if col >= lines[row].len() {
        if row + 1 < lines.len() {
            let next = lines.remove(row + 1);
            lines[row].push_str(&next);
            app.input = lines.join("\n");
        }
    } else {
        lines[row].remove(col);
        app.input = lines.join("\n");
    }
}

fn move_cursor_left(app: &mut TuiApp) {
    let (row, col) = app.input_cursor;
    if col > 0 {
        app.input_cursor = (row, col - 1);
    } else if row > 0 {
        let lines: Vec<&str> = app.input.split('\n').collect();
        let prev_len = lines[row - 1].len();
        app.input_cursor = (row - 1, prev_len);
    }
}

fn move_cursor_right(app: &mut TuiApp) {
    let (row, col) = app.input_cursor;
    let lines: Vec<&str> = app.input.split('\n').collect();
    if row >= lines.len() {
        return;
    }
    if col < lines[row].len() {
        app.input_cursor = (row, col + 1);
    } else if row + 1 < lines.len() {
        app.input_cursor = (row + 1, 0);
    }
}

fn move_cursor_up(app: &mut TuiApp) {
    let (row, col) = app.input_cursor;
    if row > 0 {
        let lines: Vec<&str> = app.input.split('\n').collect();
        let new_col = col.min(lines[row - 1].len());
        app.input_cursor = (row - 1, new_col);
    }
}

fn move_cursor_down(app: &mut TuiApp) {
    let (row, col) = app.input_cursor;
    let lines: Vec<&str> = app.input.split('\n').collect();
    if row + 1 < lines.len() {
        let new_col = col.min(lines[row + 1].len());
        app.input_cursor = (row + 1, new_col);
    }
}

fn move_cursor_line_start(app: &mut TuiApp) {
    app.input_cursor.1 = 0;
}

fn move_cursor_line_end(app: &mut TuiApp) {
    let (row, _) = app.input_cursor;
    let lines: Vec<&str> = app.input.split('\n').collect();
    if row < lines.len() {
        app.input_cursor.1 = lines[row].len();
    }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/// The emerald accent color (matches the web app).
const ACCENT: Color = Color::Rgb(16, 185, 129);
const ACCENT_TEAL: Color = Color::Rgb(20, 184, 166);
const MUTED: Color = Color::DarkGray;

fn draw(frame: &mut Frame, app: &TuiApp) {
    let area = frame.area();

    // Top-level vertical layout: top bar | main | status | input.
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // top bar
            Constraint::Min(10),   // main (sidebar + messages)
            Constraint::Length(1), // status bar
            Constraint::Length(4), // input box
        ])
        .split(area);

    draw_top_bar(frame, app, chunks[0]);

    // Main: sidebar | messages.
    let main = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Length(24), Constraint::Min(40)])
        .split(chunks[1]);
    draw_sidebar(frame, app, main[0]);
    draw_messages(frame, app, main[1]);

    draw_status_bar(frame, app, chunks[2]);
    draw_input(frame, app, chunks[3]);

    if app.show_help {
        draw_help_overlay(frame);
    }
}

fn draw_top_bar(frame: &mut Frame, app: &TuiApp, area: Rect) {
    let title = Span::styled(
        " GradBridge ",
        Style::default()
            .fg(Color::Black)
            .bg(ACCENT)
            .add_modifier(Modifier::BOLD),
    );
    let subtitle = Span::styled(
        "  Autonomous Agent · v0.2 ",
        Style::default().fg(MUTED),
    );

    // Mode chips.
    let mut chips: Vec<Span> = Vec::new();
    for (i, m) in AgentMode::all().iter().enumerate() {
        let is_active = *m == app.mode;
        let label = format!(" {} ", m.label());
        let style = if is_active {
            Style::default()
                .fg(Color::Black)
                .bg(ACCENT)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(MUTED)
        };
        chips.push(Span::styled(label, style));
        if i + 1 < AgentMode::all().len() {
            chips.push(Span::raw(" "));
        }
    }

    let mut line_spans = vec![title, subtitle, Span::raw("  ")];
    line_spans.extend(chunks);
    let line = Line::from(line_spans);

    let block = Block::default()
        .borders(Borders::BOTTOM)
        .border_style(Style::default().fg(MUTED));
    let para = Paragraph::new(line).block(block).alignment(Alignment::Left);
    frame.render_widget(para, area);
}

fn draw_sidebar(frame: &mut Frame, app: &TuiApp, area: Rect) {
    let block = Block::default()
        .borders(Borders::RIGHT)
        .border_style(Style::default().fg(MUTED))
        .title(Line::from(Span::styled(
            " Modes ",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )));

    // Modes list.
    let mode_items: Vec<ListItem> = AgentMode::all()
        .iter()
        .map(|m| {
            let active = *m == app.mode;
            let bullet = if active { "▸" } else { " " };
            let style = if active {
                Style::default().fg(ACCENT).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Gray)
            };
            ListItem::new(Line::from(vec![
                Span::styled(format!("{} ", bullet), style),
                Span::styled(m.label(), style),
            ]))
        })
        .collect();

    // Files list.
    let mut file_items: Vec<ListItem> = vec![ListItem::new(Line::from(Span::styled(
        format!(" Files ({})", app.files.len()),
        Style::default()
            .fg(ACCENT_TEAL)
            .add_modifier(Modifier::BOLD),
    )))];
    if app.files_loading {
        file_items.push(ListItem::new(Line::from(Span::styled(
            "  loading…",
            Style::default().fg(MUTED),
        ))));
    } else {
        for f in app.files.iter().take(20) {
            let (dot, color) = match f.status.as_str() {
                "modified" => ("●", Color::Yellow),
                "added" => ("◆", Color::Cyan),
                "untracked" => ("○", Color::DarkGray),
                _ => ("·", Color::Green),
            };
            let path = f.path.split('/').last().unwrap_or(&f.path);
            file_items.push(ListItem::new(Line::from(vec![
                Span::styled(format!("{} ", dot), Style::default().fg(color)),
                Span::styled(path.to_string(), Style::default().fg(Color::Gray)),
            ])));
        }
    }

    // Render modes + files in two stacked blocks inside the sidebar.
    let inner = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(8), Constraint::Min(0)])
        .split(block.inner(area));

    frame.render_widget(block, area);
    let modes_list = List::new(mode_items);
    frame.render_widget(modes_list, inner[0]);
    let files_list = List::new(file_items);
    frame.render_widget(files_list, inner[1]);
}

fn draw_messages(frame: &mut Frame, app: &TuiApp, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(MUTED))
        .title(Line::from(Span::styled(
            format!(" {} mode · {} ", app.mode, app.active_agent().name()),
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )));

    let mut lines: Vec<Line> = Vec::new();

    if app.messages.is_empty() {
        lines.push(Line::from(Span::styled(
            "What will you build today?",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )));
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            "Type a message below. Press Tab to switch modes, ? for help.",
            Style::default().fg(MUTED),
        )));
    } else {
        for msg in &app.messages {
            // Header line.
            let (name, color) = if msg.role == "user" {
                ("You".to_string(), Color::Blue)
            } else {
                (
                    msg.agent_id
                        .map(|a| a.name().to_string())
                        .unwrap_or_else(|| "Assistant".to_string()),
                    msg.agent_id.map(|a| a.accent_color()).unwrap_or(ACCENT),
                )
            };
            let mode_tag = msg
                .agent_mode
                .map(|m| format!(" [{}]", m.label()))
                .unwrap_or_default();
            lines.push(Line::from(vec![
                Span::styled(
                    format!(" {} ", name),
                    Style::default()
                        .fg(Color::Black)
                        .bg(color)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled(format!("{} ", mode_tag), Style::default().fg(MUTED)),
            ]));
            lines.push(Line::from(""));

            // Body (markdown-rendered).
            let text = markdown_to_lines(&msg.content, msg.streaming);
            for l in text {
                lines.push(l);
            }

            // Spinner while streaming.
            if msg.streaming {
                let frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                let ch = frames[app.spinner_tick % frames.len()];
                lines.push(Line::from(Span::styled(
                    format!(" {}", ch),
                    Style::default().fg(ACCENT),
                )));
            }

            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "─────────────────────────────────────────────",
                Style::default().fg(MUTED),
            )));
            lines.push(Line::from(""));
        }
    }

    // RAG context strip (if any).
    if !app.last_rag.is_empty() {
        lines.push(Line::from(Span::styled(
            " Context (RAG)",
            Style::default().fg(ACCENT_TEAL).add_modifier(Modifier::BOLD),
        )));
        for r in app.last_rag.iter().take(4) {
            lines.push(Line::from(vec![
                Span::styled(format!("  • {} ", r.title), Style::default().fg(Color::Gray)),
                Span::styled(format!("({:.2})", r.score), Style::default().fg(MUTED)),
            ]));
        }
    }

    let para = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: false })
        .scroll((app.scroll, 0));
    frame.render_widget(para, area);
}

fn draw_status_bar(frame: &mut Frame, app: &TuiApp, area: Rect) {
    let auth_dot = Span::styled("●", Style::default().fg(ACCENT));
    let auth_text = Span::styled(
        format!(" authenticated as {} ", app.user_name),
        Style::default().fg(Color::Gray),
    );
    let mode = Span::styled(
        format!("· mode {} ", app.mode.label()),
        Style::default().fg(Color::Gray),
    );
    let agent = Span::styled(
        format!("· agent {} ", app.active_agent().name()),
        Style::default().fg(Color::Gray),
    );
    let tokens = Span::styled(
        format!("· {} tok", format_tokens(app.tokens_used)),
        Style::default().fg(MUTED),
    );
    let help = Span::styled(
        "  ? help · q quit · Tab mode · c clear · r refresh",
        Style::default().fg(MUTED),
    );

    let line = Line::from(vec![auth_dot, auth_text, mode, agent, tokens, help]);
    let para = Paragraph::new(line).style(Style::default().bg(Color::Black));
    frame.render_widget(para, area);
}

fn draw_input(frame: &mut Frame, app: &TuiApp, area: Rect) {
    let prompt = if app.streaming { "⋯" } else { "›" };
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if app.streaming { ACCENT_TEAL } else { MUTED }))
        .title(Line::from(Span::styled(
            format!(" {} ", if app.streaming { "Thinking" } else { "Input" }),
            Style::default().fg(if app.streaming { ACCENT_TEAL } else { ACCENT }),
        )));

    let inner = block.inner(area);
    frame.render_widget(block, area);

    let mut lines: Vec<Line> = Vec::new();
    let input_lines: Vec<&str> = if app.input.is_empty() {
        vec![""]
    } else {
        app.input.split('\n').collect()
    };
    for (i, l) in input_lines.iter().enumerate() {
        if i == 0 {
            lines.push(Line::from(vec![
                Span::styled(format!("{} ", prompt), Style::default().fg(ACCENT)),
                Span::raw(l.to_string()),
            ]));
        } else {
            lines.push(Line::from(vec![
                Span::styled("  ", Style::default().fg(MUTED)),
                Span::raw(l.to_string()),
            ]));
        }
    }

    let para = Paragraph::new(lines);
    frame.render_widget(para, inner);

    // Cursor.
    let (row, col) = app.input_cursor;
    let cursor_x = inner.x + 2 + col as u16;
    let cursor_y = inner.y + row as u16;
    frame.set_cursor_position((cursor_x, cursor_y));
}

fn draw_help_overlay(frame: &mut Frame) {
    let area = centered_rect(60, 60, frame.area());
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(ACCENT))
        .title(Line::from(Span::styled(
            " Help ",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )));

    let lines = vec![
        Line::from(Span::styled(
            "Keybindings",
            Style::default()
                .fg(ACCENT_TEAL)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(vec![Span::styled("  Enter        ", Style::default().fg(ACCENT)), Span::raw("send message")]),
        Line::from(vec![Span::styled("  Shift+Enter  ", Style::default().fg(ACCENT)), Span::raw("newline")]),
        Line::from(vec![Span::styled("  Tab          ", Style::default().fg(ACCENT)), Span::raw("next mode")]),
        Line::from(vec![Span::styled("  Shift+Tab    ", Style::default().fg(ACCENT)), Span::raw("previous mode")]),
        Line::from(vec![Span::styled("  c            ", Style::default().fg(ACCENT)), Span::raw("clear conversation")]),
        Line::from(vec![Span::styled("  r            ", Style::default().fg(ACCENT)), Span::raw("refresh files")]),
        Line::from(vec![Span::styled("  ?            ", Style::default().fg(ACCENT)), Span::raw("toggle this help")]),
        Line::from(vec![Span::styled("  q / Ctrl+C   ", Style::default().fg(ACCENT)), Span::raw("quit")]),
        Line::from(""),
        Line::from(Span::styled("Press ? to close", Style::default().fg(MUTED))),
    ];
    let para = Paragraph::new(lines).block(block).alignment(Alignment::Left);
    frame.render_widget(para, area);
}

// ---------------------------------------------------------------------------
// Minimal markdown → ratatui Lines renderer
// ---------------------------------------------------------------------------

/// Render a markdown string into ratatui `Line`s with:
///   - `#` / `##` / `###` headings (bold + accent)
///   - fenced code blocks (monospace + dark bg)
///   - `- ` / `* ` bullets
///   - `1. ` numbered lists
///   - inline `**bold**` and `` `code` `` (markers stripped — full inline
///     span styling is left as a TODO)
fn markdown_to_lines(md: &str, streaming: bool) -> Vec<Line> {
    let mut out: Vec<Line> = Vec::new();
    let mut in_code = false;
    let mut code_lang: String = String::new();
    let mut code_lines: Vec<String> = Vec::new();

    for raw in md.lines() {
        // Fence toggle.
        if raw.trim_start().starts_with("```") {
            if in_code {
                render_code_block(&mut out, &code_lang, &code_lines);
                code_lines.clear();
                code_lang.clear();
                in_code = false;
            } else {
                code_lang = raw
                    .trim_start()
                    .trim_start_matches('`')
                    .trim()
                    .to_string();
                in_code = true;
            }
            continue;
        }
        if in_code {
            code_lines.push(raw.to_string());
            continue;
        }

        // Headings.
        if let Some(rest) = raw.strip_prefix("### ") {
            out.push(Line::from(Span::styled(
                rest.to_string(),
                Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
            )));
            continue;
        }
        if let Some(rest) = raw.strip_prefix("## ") {
            out.push(Line::from(Span::styled(
                rest.to_string(),
                Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
            )));
            continue;
        }
        if let Some(rest) = raw.strip_prefix("# ") {
            out.push(Line::from(Span::styled(
                rest.to_string(),
                Style::default()
                    .fg(ACCENT_TEAL)
                    .add_modifier(Modifier::BOLD),
            )));
            continue;
        }

        // Bullets.
        let trimmed = raw.trim_start();
        if let Some(rest) = trimmed
            .strip_prefix("- ")
            .or_else(|| trimmed.strip_prefix("* "))
        {
            out.push(Line::from(vec![
                Span::styled("  • ", Style::default().fg(ACCENT)),
                Span::raw(render_inline(rest)),
            ]));
            continue;
        }

        // Numbered list (e.g. "1. foo").
        if let Some(idx) = raw.find(". ") {
            let prefix = &raw[..idx];
            if !prefix.is_empty() && prefix.chars().all(|c| c.is_ascii_digit()) {
                let rest = &raw[idx + 2..];
                out.push(Line::from(vec![
                    Span::styled(format!("  {}. ", prefix), Style::default().fg(ACCENT)),
                    Span::raw(render_inline(rest)),
                ]));
                continue;
            }
        }

        // Plain line with inline formatting.
        if raw.trim().is_empty() {
            out.push(Line::from(""));
        } else {
            out.push(Line::from(vec![Span::raw(render_inline(raw))]));
        }
    }

    // If we're inside a code block (streaming or unterminated), render what we have.
    if in_code {
        render_code_block(&mut out, &code_lang, &code_lines);
    }

    out
}

/// Render inline markdown: strip `**bold**` and `` `code` `` markers but keep
/// the content. (For full inline styling, build a `Vec<Span>` — left as a TODO
/// since ratatui's `Span` can't carry nested styles.)
fn render_inline(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        // ** bold **
        if i + 1 < bytes.len() && bytes[i] == b'*' && bytes[i + 1] == b'*' {
            if let Some(end) = s[i + 2..].find("**") {
                out.push_str(&s[i + 2..i + 2 + end]);
                i = i + 2 + end + 2;
                continue;
            }
        }
        // ` code `
        if bytes[i] == b'`' {
            if let Some(end) = s[i + 1..].find('`') {
                out.push_str(&s[i + 1..i + 1 + end]);
                i = i + 1 + end + 1;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

fn render_code_block(out: &mut Vec<Line>, lang: &str, lines: &[String]) {
    let header = format!(" ┌─ {} ", if lang.is_empty() { "code" } else { lang });
    out.push(Line::from(Span::styled(
        header,
        Style::default().fg(ACCENT_TEAL).bg(Color::Black),
    )));
    for l in lines {
        out.push(Line::from(Span::styled(
            format!(" │ {}", l),
            Style::default().fg(Color::Gray).bg(Color::Black),
        )));
    }
    out.push(Line::from(Span::styled(
        " └─",
        Style::default().fg(ACCENT_TEAL).bg(Color::Black),
    )));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn format_tokens(n: i64) -> String {
    if n >= 1000 {
        format!("{:.1}k", n as f64 / 1000.0)
    } else {
        n.to_string()
    }
}

/// Return a centered rect (for the help overlay). From the ratatui cookbook.
fn centered_rect(percent_x: u16, percent_y: u16, area: Rect) -> Rect {
    let pop_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(area);
    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(pop_layout[1])[1]
}
