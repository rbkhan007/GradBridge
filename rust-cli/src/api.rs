//! HTTP client wrapping the GradBridge web API.
//!
//! The CLI is a thin client: it NEVER calls LLMs directly (the web app is the
//! backend). Every request sends the `gb_session` cookie from the local config
//! so the web app's `requireUser` middleware authenticates the call.
//!
//! All structs mirror the TypeScript types in `src/lib/types.ts` and the JSON
//! shapes returned by the API routes in `src/app/api/`.

use std::pin::Pin;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use futures::Stream;
use reqwest::{Client, Method, RequestBuilder, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::agents::{AgentId, AgentMode};
use crate::config::{Config, SessionUser, SESSION_COOKIE_NAME};

// ---------------------------------------------------------------------------
// Shared data types (mirror src/lib/types.ts)
// ---------------------------------------------------------------------------

/// A chat message (user or assistant). Mirrors `ChatMessage`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String, // "user" | "assistant"
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    pub created_at: String,
}

/// A RAG retrieval result. Mirrors `RagResult`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagResult {
    #[serde(rename = "type")] // "file" | "knowledge"
    pub kind: String,
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub score: f64,
    pub source: String,
}

/// The user's career profile (memory). Mirrors `UserProfile`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: String,
    pub name: String,
    pub university: String,
    pub major: String,
    pub graduation_year: i32,
    pub target_role: String,
    pub experience_level: String,
    pub skills: Vec<String>,
    pub goals: Vec<String>,
}

/// An indexed project file. Mirrors `ProjectFile`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub id: String,
    pub path: String,
    pub language: String,
    pub content: String,
    pub status: String, // "clean" | "modified" | "added" | "untracked"
    pub indexed_at: String,
}

/// A knowledge-base entry. Mirrors `KnowledgeEntry`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub category: String,
    pub tags: Vec<String>,
    pub content: String,
    pub source: String,
}

/// A structured plan from the Plan agent. Mirrors `Plan`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub content: String,
    pub status: String, // "draft" | "approved" | "applied"
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct LoginRequest<'a> {
    pub email: &'a str,
    pub password: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest<'a> {
    pub message: &'a str,
    pub mode: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<&'a str>,
}

#[derive(Debug, Serialize)]
pub struct PlanRequest<'a> {
    pub goal: &'a str,
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct LoginResponse {
    pub user: SessionUser,
}

#[derive(Debug, Deserialize)]
pub struct MeResponse {
    pub user: SessionUser,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    pub conversation_id: String,
    pub message: ChatMessage,
    #[serde(default)]
    pub rag_results: Vec<RagResult>,
    #[serde(default)]
    pub tokens_used: i64,
    #[serde(default)]
    pub provider: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanResponse {
    pub plan: Plan,
    #[serde(default)]
    pub rag_results: Vec<RagResult>,
    #[serde(default)]
    pub tokens_used: i64,
}

#[derive(Debug, Deserialize)]
pub struct FilesResponse {
    pub files: Vec<ProjectFile>,
}

#[derive(Debug, Deserialize)]
pub struct MemoryResponse {
    pub profile: UserProfile,
}

#[derive(Debug, Deserialize)]
pub struct KnowledgeResponse {
    pub entries: Vec<KnowledgeEntry>,
    #[serde(default)]
    pub query: Option<String>,
}

/// Standard error envelope returned by every API route on failure.
#[derive(Debug, Deserialize)]
pub struct ApiError {
    pub error: String,
    #[serde(default)]
    pub detail: Option<String>,
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/// A tiny wrapper around `reqwest::Client` that knows the GradBridge API base
/// URL + injects the session cookie on every request.
#[derive(Debug, Clone)]
pub struct GradBridgeApi {
    pub client: Client,
    pub base_url: String,
    pub session_token: String,
}

impl GradBridgeApi {
    /// Build a client from the loaded config.
    pub fn from_config(cfg: &Config) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(120)) // LLM calls can be slow
            .cookie_store(false) // we manage the cookie manually for clarity
            .build()
            .context("failed to build HTTP client")?;
        Ok(Self {
            client,
            base_url: cfg.api_base.trim_end_matches('/').to_string(),
            session_token: cfg.session_token.clone(),
        })
    }

    // --- Internal helpers ---

    /// Build a request with the session cookie attached.
    fn request(&self, method: Method, path: &str) -> RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.client.request(method, &url);
        if !self.session_token.is_empty() {
            req = req.header(
                reqwest::header::COOKIE,
                format!("{}={}", SESSION_COOKIE_NAME, self.session_token),
            );
        }
        req
    }

    /// Send a request, parse JSON on 2xx, or return a structured error on 4xx/5xx.
    async fn send_json<T: DeserializeOwned>(&self, req: RequestBuilder) -> Result<T> {
        let resp = req.send().await.context("HTTP request failed")?;
        let status = resp.status();
        if status.is_success() {
            let body = resp.json::<T>().await.context("failed to decode JSON")?;
            return Ok(body);
        }
        // Try to decode the standard { error, detail } envelope.
        let text = resp.text().await.unwrap_or_default();
        let api_err: Option<ApiError> = serde_json::from_str(&text).ok();
        let msg = api_err
            .map(|e| match e.detail {
                Some(d) => format!("{} ({})", e.error, d),
                None => e.error,
            })
            .unwrap_or_else(|| format!("HTTP {} — {}", status, text));
        Err(anyhow!(msg).context(format!("status {}", status)))
    }

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------

    /// POST /api/auth/login — exchange email + password for a session cookie.
    ///
    /// NOTE: the cookie is returned in the `Set-Cookie` response header, NOT
    /// in the JSON body. We extract it from the headers and return the token
    /// alongside the user so the caller can persist it via `config::update`.
    pub async fn login(&self, email: &str, password: &str) -> Result<(SessionUser, String)> {
        let req = self
            .request(Method::POST, "/api/auth/login")
            .json(&LoginRequest { email, password });
        let resp = req.send().await.context("login request failed")?;
        let status = resp.status();
        // Capture the Set-Cookie header BEFORE consuming the body.
        let set_cookie = resp
            .headers()
            .get(reqwest::header::SET_COOKIE)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            let api_err: Option<ApiError> = serde_json::from_str(&text).ok();
            let msg = api_err
                .map(|e| e.error)
                .unwrap_or_else(|| format!("HTTP {} — {}", status, text));
            return Err(anyhow!(msg));
        }
        let parsed: LoginResponse =
            serde_json::from_str(&text).context("failed to decode login response")?;

        // Parse `gb_session=...; Path=/; HttpOnly; ...` → just the value.
        let token = set_cookie
            .as_deref()
            .and_then(|c| c.split(';').next())
            .and_then(|kv| kv.strip_prefix(&format!("{}=", SESSION_COOKIE_NAME)))
            .map(|s| s.to_string())
            .ok_or_else(|| {
                anyhow!("login succeeded but no {} cookie was set", SESSION_COOKIE_NAME)
            })?;
        Ok((parsed.user, token))
    }

    /// GET /api/auth/me — fetch the currently authenticated user.
    pub async fn me(&self) -> Result<SessionUser> {
        let req = self.request(Method::GET, "/api/auth/me");
        let parsed: MeResponse = self.send_json(req).await?;
        Ok(parsed.user)
    }

    /// POST /api/auth/logout — invalidate the session.
    pub async fn logout(&self) -> Result<()> {
        let req = self.request(Method::POST, "/api/auth/logout");
        // We don't care about the body, just that it succeeded.
        let resp = req.send().await.context("logout request failed")?;
        if !resp.status().is_success() {
            return Err(anyhow!("logout failed: HTTP {}", resp.status()));
        }
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Chat
    // -----------------------------------------------------------------------

    /// POST /api/chat — non-streaming agent chat.
    pub async fn chat(
        &self,
        message: &str,
        mode: AgentMode,
        agent_id: Option<AgentId>,
        conversation_id: Option<&str>,
    ) -> Result<ChatResponse> {
        let agent_str = agent_id.map(|a| a.as_str());
        let body = ChatRequest {
            message,
            mode: mode.as_str(),
            agent_id: agent_str,
            conversation_id,
        };
        let req = self.request(Method::POST, "/api/chat").json(&body);
        self.send_json(req).await
    }

    /// POST /api/chat/stream — SSE streaming agent chat.
    ///
    /// Returns a stream of incremental text chunks (deltas). If the streaming
    /// endpoint is unavailable (404 — it's a roadmap item), falls back to the
    /// non-streaming `/api/chat` endpoint and emits the full message as a
    /// single chunk.
    ///
    /// The return type is a pinned, boxed stream so the two code paths (SSE
    /// vs. fallback) can share a single concrete type.
    ///
    /// Usage:
    /// ```ignore
    /// use futures::StreamExt;
    /// let mut stream = api.chat_stream("hello", AgentMode::Chat, None, None).await?;
    /// while let Some(chunk) = stream.next().await {
    ///     print!("{}", chunk?);
    /// }
    /// ```
    pub async fn chat_stream(
        &self,
        message: &str,
        mode: AgentMode,
        agent_id: Option<AgentId>,
        conversation_id: Option<&str>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<SseEvent>> + Send>>> {
        let agent_str = agent_id.map(|a| a.as_str());
        let body = ChatRequest {
            message,
            mode: mode.as_str(),
            agent_id: agent_str,
            conversation_id,
        };

        let probe = self
            .request(Method::POST, "/api/chat/stream")
            .json(&body)
            .send()
            .await;

        match probe {
            Ok(resp) if resp.status() == StatusCode::OK => {
                // SSE stream — SseDecoder parses typed events.
                let byte_stream = resp.bytes_stream();
                let sse = SseDecoder::new(byte_stream);
                Ok(Box::pin(sse))
            }
            _ => {
                // Fallback: call /api/chat once and emit the full content as
                // a single Done event.
                let full = self.chat(message, mode, agent_id, conversation_id).await?;
                let content = full.message.content.clone();
                let done = SseEvent::Done {
                    message_id: full.message.id,
                    tokens: full.tokens_used as i64,
                    provider: "fallback".into(),
                };
                let meta = SseEvent::Meta {
                    conversation_id: full.conversation_id,
                    rag: full.rag_results,
                    agent_id: agent_id.map(|a| a.as_str().to_string()),
                    agent_name: None,
                };
                // Emit meta first, then delta with full content, then done.
                let events = vec![Ok(meta), Ok(SseEvent::Delta(content)), Ok(done)];
                let stream = tokio_stream::iter(events);
                Ok(Box::pin(stream))
            }
        }
    }

    // -----------------------------------------------------------------------
    // Plan
    // -----------------------------------------------------------------------

    /// POST /api/plan — Plan agent produces a structured markdown plan.
    pub async fn plan(&self, goal: &str) -> Result<PlanResponse> {
        let body = PlanRequest { goal };
        let req = self.request(Method::POST, "/api/plan").json(&body);
        self.send_json(req).await
    }

    // -----------------------------------------------------------------------
    // Files (orchestrator)
    // -----------------------------------------------------------------------

    /// GET /api/files — list all indexed project files (with content).
    pub async fn files(&self) -> Result<Vec<ProjectFile>> {
        let req = self.request(Method::GET, "/api/files");
        let parsed: FilesResponse = self.send_json(req).await?;
        Ok(parsed.files)
    }

    // -----------------------------------------------------------------------
    // Memory (user profile)
    // -----------------------------------------------------------------------

    /// GET /api/memory — fetch the current user's profile.
    pub async fn memory(&self) -> Result<UserProfile> {
        let req = self.request(Method::GET, "/api/memory");
        let parsed: MemoryResponse = self.send_json(req).await?;
        Ok(parsed.profile)
    }

    // -----------------------------------------------------------------------
    // Knowledge (RAG corpus browser)
    // -----------------------------------------------------------------------

    /// GET /api/knowledge?q=... — list / search the knowledge base.
    pub async fn knowledge(&self, query: Option<&str>) -> Result<Vec<KnowledgeEntry>> {
        let path = match query {
            Some(q) if !q.is_empty() => format!("/api/knowledge?q={}", urlencoding(q)),
            _ => "/api/knowledge".to_string(),
        };
        let req = self.request(Method::GET, &path);
        let parsed: KnowledgeResponse = self.send_json(req).await?;
        Ok(parsed.entries)
    }
}

// ---------------------------------------------------------------------------
// SSE decoding (for /api/chat/stream)
// ---------------------------------------------------------------------------

/// A parsed SSE event from the web app's streaming chat endpoint.
/// The protocol sends typed JSON events: meta, delta, done, error.
#[derive(Debug, Clone)]
pub enum SseEvent {
    /// Stream metadata: conversation ID, RAG results, agent info.
    Meta {
        conversation_id: String,
        rag: Vec<RagResult>,
        agent_id: Option<String>,
        agent_name: Option<String>,
    },
    /// A content delta chunk to append to the assistant's message.
    Delta(String),
    /// Stream complete — carries the persisted message metadata.
    Done {
        message_id: String,
        tokens: i64,
        provider: String,
    },
    /// A server-side error occurred.
    Error(String),
}

/// A minimal SSE decoder that turns a byte stream into a stream of
/// typed SseEvent values. Parses the web app's structured SSE protocol:
///
///   data: {"type":"meta","conversationId":"...","ragResults":[...],...}
///   data: {"type":"delta","content":"..."}
///   data: {"type":"done","messageId":"...","tokensUsed":...,"provider":"..."}
///   data: {"type":"error","error":"..."}
///   data: [DONE]
struct SseDecoder<S> {
    inner: S,
    buffer: Vec<u8>,
    text_buf: String,
    pending_rag: Vec<RagResult>,
    pending_conversation_id: Option<String>,
    pending_agent_id: Option<String>,
    pending_agent_name: Option<String>,
}

impl<S> SseDecoder<S>
where
    S: Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin,
{
    fn new(inner: S) -> Self {
        Self {
            inner,
            buffer: Vec::new(),
            text_buf: String::new(),
            pending_rag: Vec::new(),
            pending_conversation_id: None,
            pending_agent_id: None,
            pending_agent_name: None,
        }
    }

    /// Parse a single SSE data payload into an SseEvent.
    fn parse_event(payload: &str) -> Option<SseEvent> {
        if payload == "[DONE]" {
            return None;
        }
        // Try parsing as the web app's typed JSON protocol.
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(payload) {
            if let Some(typ) = val.get("type").and_then(|v| v.as_str()) {
                return match typ {
                    "meta" => {
                        let cid = val
                            .get("conversationId")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let rag: Vec<RagResult> = val
                            .get("ragResults")
                            .and_then(|v| serde_json::from_value(v.clone()).ok())
                            .unwrap_or_default();
                        let agent_id = val.get("agentId").and_then(|v| v.as_str()).map(|s| s.to_string());
                        let agent_name = val
                            .get("agentName")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        Some(SseEvent::Meta {
                            conversation_id: cid,
                            rag,
                            agent_id,
                            agent_name,
                        })
                    }
                    "delta" => {
                        let content = val
                            .get("content")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        Some(SseEvent::Delta(content))
                    }
                    "done" => {
                        let message_id = val
                            .get("messageId")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let tokens = val.get("tokensUsed").and_then(|v| v.as_i64()).unwrap_or(0);
                        let provider = val
                            .get("provider")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string();
                        Some(SseEvent::Done {
                            message_id,
                            tokens,
                            provider,
                        })
                    }
                    "error" => {
                        let error = val
                            .get("error")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown error")
                            .to_string();
                        Some(SseEvent::Error(error))
                    }
                    _ => {
                        // Unknown type — treat as delta content for backward compatibility.
                        Some(SseEvent::Delta(payload.to_string()))
                    }
                };
            }
        }
        // Fallback: not JSON or missing type field — treat as delta content.
        Some(SseEvent::Delta(payload.to_string()))
    }
}

impl<S> Stream for SseDecoder<S>
where
    S: Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin,
{
    type Item = Result<SseEvent>;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let this = self.get_mut();

        loop {
            // 1. Try to find a complete SSE event in the text buffer.
            if let Some(idx) = this.text_buf.find("\n\n") {
                let event: String = this.text_buf.drain(..idx + 2).collect();
                let mut data = String::new();
                for line in event.lines() {
                    if let Some(rest) = line.strip_prefix("data:") {
                        let rest = rest.strip_prefix(' ').unwrap_or(rest);
                        data.push_str(rest);
                        data.push('\n');
                    }
                }
                if data.is_empty() {
                    continue; // comment / keep-alive line — look for the next event
                }
                if data.ends_with('\n') {
                    data.pop();
                }
                if data == "[DONE]" {
                    return std::task::Poll::Ready(None);
                }

                // Try to preserve the meta/agent context across events.
                // A meta event may arrive before deltas — hold the pending
                // metadata so downstream code doesn't get out-of-order events.
                match Self::parse_event(&data) {
                    Some(SseEvent::Meta { conversation_id, rag, agent_id, agent_name }) => {
                        this.pending_conversation_id = Some(conversation_id);
                        this.pending_rag = rag;
                        this.pending_agent_id = agent_id;
                        this.pending_agent_name = agent_name;
                        // Don't emit Meta as a separate event — the downstream
                        // handler will get the conversation_id from the Done event.
                        // We store it for the next data event instead.
                        continue;
                    }
                    Some(SseEvent::Delta(content)) => {
                        return std::task::Poll::Ready(Some(Ok(SseEvent::Delta(content))));
                    }
                    Some(other) => {
                        return std::task::Poll::Ready(Some(Ok(other)));
                    }
                    None => {
                        return std::task::Poll::Ready(None);
                    }
                }
            }

            // 2. Otherwise, pull more bytes from the underlying HTTP stream.
            match std::pin::Pin::new(&mut this.inner).poll_next(cx) {
                std::task::Poll::Ready(Some(Ok(chunk))) => {
                    this.buffer.extend_from_slice(&chunk);
                    let valid_len = match std::str::from_utf8(&this.buffer) {
                        Ok(_) => this.buffer.len(),
                        Err(e) => e.valid_up_to(),
                    };
                    if valid_len > 0 {
                        let valid =
                            unsafe { std::str::from_utf8_unchecked(&this.buffer[..valid_len]) };
                        this.text_buf.push_str(valid);
                        this.buffer.drain(..valid_len);
                    }
                }
                std::task::Poll::Ready(Some(Err(e))) => {
                    return std::task::Poll::Ready(Some(Err(anyhow::Error::from(e))));
                }
                std::task::Poll::Ready(None) => {
                    if !this.buffer.is_empty() {
                        if let Ok(s) = std::str::from_utf8(&this.buffer) {
                            this.text_buf.push_str(s);
                        }
                        this.buffer.clear();
                    }
                    if this.text_buf.trim().is_empty() {
                        return std::task::Poll::Ready(None);
                    }
                    let remaining = std::mem::take(&mut this.text_buf);
                    return std::task::Poll::Ready(Some(Ok(
                        Self::parse_event(&remaining).unwrap_or(SseEvent::Delta(remaining)),
                    )));
                }
                std::task::Poll::Pending => {
                    return std::task::Poll::Pending;
                }
            }
        }
    }
}

/// Minimal percent-encoder for query-string values (encodes spaces + a few
/// reserved chars). Good enough for the knowledge-base search box.
fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
