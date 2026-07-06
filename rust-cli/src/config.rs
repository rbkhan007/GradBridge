//! Config loading + persistence for the GradBridge CLI.
//!
//! Config lives at `~/.gradbridge/config.toml` and stores:
//!   - `api_base`       — the base URL of the GradBridge web app
//!   - `session_token`  — the `gb_session` cookie value (set after `login`)
//!   - `user`           — cached `SessionUser` (name + email) after `login`
//!
//! The TOML format is human-readable + hand-editable. Missing fields fall back
//! to sensible defaults so a fresh `gradbridge` install works without a config
//! file (it just won't be authenticated until `gradbridge login`).

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// The default GradBridge web app base URL.
pub const DEFAULT_API_BASE: &str = "http://localhost:3000";

/// The name of the session cookie the web app sets (`src/lib/auth.ts`).
pub const SESSION_COOKIE_NAME: &str = "gb_session";

/// The CLI config — serialized as TOML to `~/.gradbridge/config.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Base URL of the GradBridge web app (no trailing slash).
    #[serde(default = "default_api_base")]
    pub api_base: String,

    /// The `gb_session` cookie value. Empty until `gradbridge login` succeeds.
    #[serde(default)]
    pub session_token: String,

    /// Cached authenticated user. `None` until login.
    #[serde(default)]
    pub user: Option<SessionUser>,

    /// If true, the CLI runs in local-first mode (direct Ollama + offline RAG,
    /// no web backend). Set with `--local` or in the config file.
    #[serde(default)]
    pub local_mode: bool,

    /// Ollama base URL for local-first mode (default: http://localhost:11434).
    #[serde(default = "default_ollama_url")]
    pub ollama_url: String,

    /// Ollama model for local-first mode (default: qwen2.5-coder:7b).
    #[serde(default = "default_ollama_model")]
    pub ollama_model: String,
}

/// The authenticated user, mirrored from the web app's `SessionUser` type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUser {
    pub id: String,
    pub name: String,
    pub email: String,
    #[serde(default = "default_user_role")]
    pub role: String,
}

fn default_user_role() -> String {
    "user".to_string()
}

fn default_api_base() -> String {
    DEFAULT_API_BASE.to_string()
}

fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

fn default_ollama_model() -> String {
    "qwen2.5-coder:7b".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_base: default_api_base(),
            session_token: String::new(),
            user: None,
            local_mode: false,
            ollama_url: default_ollama_url(),
            ollama_model: default_ollama_model(),
        }
    }
}

impl Config {
    /// True if the config has a non-empty session token.
    pub fn is_authenticated(&self) -> bool {
        !self.session_token.is_empty()
    }
}

/// Resolve the config directory: `~/.gradbridge/`.
///
/// Honors `$XDG_CONFIG_HOME` + `$HOME` via the `dirs` crate. Falls back to
/// `.gradbridge` in the current directory if neither is available.
pub fn config_dir() -> Result<PathBuf> {
    if let Some(dir) = dirs::config_dir() {
        return Ok(dir.join("gradbridge"));
    }
    if let Some(home) = dirs::home_dir() {
        return Ok(home.join(".gradbridge"));
    }
    Ok(PathBuf::from(".gradbridge"))
}

/// Resolve the config file path: `~/.gradbridge/config.toml`.
pub fn config_path() -> Result<PathBuf> {
    Ok(config_dir()?.join("config.toml"))
}

/// Load the config from disk. Returns `Config::default()` if the file does not
/// exist (a fresh install). Propagates parse / IO errors.
pub fn load() -> Result<Config> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(Config::default());
    }
    let raw = fs::read_to_string(&path)
        .with_context(|| format!("failed to read config at {}", path.display()))?;
    let cfg: Config = toml::from_str(&raw)
        .with_context(|| format!("failed to parse config at {}", path.display()))?;
    Ok(cfg)
}

/// Save the config to disk, creating the parent directory if needed.
pub fn save(cfg: &Config) -> Result<()> {
    let path = config_path()?;
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    if !dir.exists() {
        fs::create_dir_all(dir)
            .with_context(|| format!("failed to create config dir {}", dir.display()))?;
    }
    let raw = toml::to_string_pretty(cfg).context("failed to serialize config")?;
    fs::write(&path, raw)
        .with_context(|| format!("failed to write config to {}", path.display()))?;
    Ok(())
}

/// Update the config in-place via a closure, then persist it atomically.
pub fn update<F>(mutator: F) -> Result<Config>
where
    F: FnOnce(&mut Config),
{
    let mut cfg = load()?;
    mutator(&mut cfg);
    save(&cfg)?;
    Ok(cfg)
}
