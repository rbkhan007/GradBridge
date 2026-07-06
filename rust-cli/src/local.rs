//! Local-first mode — direct Ollama LLM calls + offline RAG, no web backend.
//!
//! When the CLI is run with `--local` (or `local_mode = true` in config), it:
//!   1. Calls a local Ollama instance directly (OpenAI-compatible API)
//!   2. Uses the local SQLite RAG index (see `rag.rs`) for context
//!   3. Requires NO authentication and NO running web backend
//!
//! This is the "offline / private" mode — everything stays on the user's
//! machine. The only external dependency is a running Ollama daemon
//! (https://ollama.ai), which serves models locally.
//!
//! The system prompts are shared with the web app via `agents.rs` so the
//! agent behavior is identical whether you use the web app or the CLI.

use std::io::Write;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use colored::Colorize;
use serde::{Deserialize, Serialize};

use crate::agents::{agent_definition, resolve_agent, AgentId, AgentMode};
use crate::config::Config;
use crate::rag;

// ---------------------------------------------------------------------------
// Types (mirror the OpenAI / Ollama chat completions API)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
struct ChatMessage {
    role: &'static str,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    #[serde(default)]
    content: Option<String>,
}

// ---------------------------------------------------------------------------
// Local LLM client
// ---------------------------------------------------------------------------

/// A local-first LLM client that talks directly to an Ollama instance.
pub struct LocalLlm {
    client: reqwest::Client,
    base_url: String,
    model: String,
}

impl LocalLlm {
    /// Create from config. Reads `ollama_url` + `ollama_model` from the config.
    pub fn from_config(cfg: &Config) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            base_url: cfg
                .ollama_url
                .trim_end_matches('/')
                .to_string(),
            model: cfg.ollama_model.clone(),
        }
    }

    /// Check if the Ollama daemon is reachable + the model is available.
    pub async fn health(&self) -> Result<String> {
        let res = self
            .client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .context("Cannot reach Ollama — is it running? Start with `ollama serve`")?;
        if !res.status().is_success() {
            return Err(anyhow!("Ollama health check failed: HTTP {}", res.status()));
        }
        Ok(format!("Ollama reachable at {} · model: {}", self.base_url, self.model))
    }

    /// Run a non-streaming completion.
    pub async fn complete(&self, messages: Vec<ChatMessage>) -> Result<String> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = ChatRequest {
            model: self.model.clone(),
            messages,
            stream: false,
        };
        let res = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .context("Failed to send request to Ollama")?;
        if !res.status().is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Ollama error: {}", text));
        }
        let data: ChatResponse = res.json().await.context("Failed to parse Ollama response")?;
        Ok(data
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .unwrap_or_default())
    }

    /// Run a streaming completion — calls `on_delta` for each token chunk.
    pub async fn complete_stream<F>(&self, messages: Vec<ChatMessage>, mut on_delta: F) -> Result<String>
    where
        F: FnMut(&str),
    {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = ChatRequest {
            model: self.model.clone(),
            messages,
            stream: true,
        };
        let res = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .context("Failed to send streaming request to Ollama")?;
        if !res.status().is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Ollama stream error: {}", text));
        }

        let mut full = String::new();
        use futures::StreamExt;
        let mut stream = res.bytes_stream();
        let mut buf = String::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.context("Stream read error")?;
            buf.push_str(&String::from_utf8_lossy(&chunk));

            // SSE events are separated by double newlines
            while let Some(idx) = buf.find("\n\n") {
                let event = buf[..idx].to_string();
                buf = buf[idx + 2..].to_string();
                for line in event.lines() {
                    let line = line.trim();
                    if !line.starts_with("data:") {
                        continue;
                    }
                    let data = line[5..].trim();
                    if data == "[DONE]" {
                        return Ok(full);
                    }
                    if let Ok(chunk) = serde_json::from_str::<StreamChunk>(data) {
                        if let Some(delta) = chunk.choices.into_iter().next().and_then(|c| c.delta.content)
                        {
                            if !delta.is_empty() {
                                on_delta(&delta);
                                full.push_str(&delta);
                            }
                        }
                    }
                }
            }
        }
        Ok(full)
    }
}

// ---------------------------------------------------------------------------
// High-level local-first operations (mirror the web app's agent flow)
// ---------------------------------------------------------------------------

/// Run a local-first agent completion: resolve the agent, build the system
/// prompt, inject local RAG context, and call Ollama.
pub async fn run_local(
    cfg: &Config,
    message: &str,
    mode: AgentMode,
    agent_override: Option<AgentId>,
    stream: bool,
) -> Result<String> {
    let llm = LocalLlm::from_config(cfg);
    let agent_def = agent_definition(resolve_agent(mode, agent_override));

    // Build the RAG context from the local index.
    let rag_ctx = match rag::search(message, 4).await {
        Ok(results) if !results.is_empty() => {
            let blocks: Vec<String> = results
                .iter()
                .enumerate()
                .map(|(i, r)| format!("[CTX {}] {} ({})\n{}", i + 1, r.path, r.language, r.snippet))
                .collect();
            format!(
                "Relevant context from your local codebase:\n\n{}\n\n---\n\n",
                blocks.join("\n\n")
            )
        }
        _ => String::new(),
    };

    // Assemble messages: system prompt (with RAG) + user message.
    let messages = vec![
        ChatMessage {
            role: "system",
            content: format!("{}\n\n{}", agent_def.system_prompt, rag_ctx),
        },
        ChatMessage {
            role: "user",
            content: message.to_string(),
        },
    ];

    if stream {
        // Stream to stdout with a leading newline.
        print!("\n");
        let _ = std::io::stdout().flush();
        let result = llm
            .complete_stream(messages, |delta| {
                print!("{}", delta);
                let _ = std::io::stdout().flush();
            })
            .await?;
        println!();
        Ok(result)
    } else {
        let content = llm.complete(messages).await?;
        println!("\n{}\n", content);
        Ok(content)
    }
}

/// Quick health check for the local Ollama instance.
pub async fn check_local(cfg: &Config) -> Result<()> {
    let llm = LocalLlm::from_config(cfg);
    let status = llm.health().await?;
    println!("{} {}", "✓".green(), status);
    Ok(())
}
