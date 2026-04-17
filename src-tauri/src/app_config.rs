// Global (non-workspace) config: which workspaces the user has opened recently.
// Lives outside any workspace so it persists across workspace switches.

use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::{Result, YarrowError};

const MAX_RECENT: usize = 10;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentWorkspace {
    pub path: String,
    pub name: String,
    pub last_opened: String,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct AppConfig {
    #[serde(default)]
    pub recent: Vec<RecentWorkspace>,
}

fn app_config_dir() -> Result<PathBuf> {
    let base = dirs::config_dir()
        .ok_or_else(|| YarrowError::Other("no config dir available".into()))?;
    Ok(base.join("yarrow"))
}

fn app_config_path() -> Result<PathBuf> {
    Ok(app_config_dir()?.join("app.toml"))
}

pub fn load() -> AppConfig {
    (|| -> Result<AppConfig> {
        let path = app_config_path()?;
        if !path.exists() {
            return Ok(AppConfig::default());
        }
        let raw = std::fs::read_to_string(path)?;
        Ok(toml::from_str(&raw).unwrap_or_default())
    })()
    .unwrap_or_default()
}

fn save(cfg: &AppConfig) -> Result<()> {
    let path = app_config_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = toml::to_string_pretty(cfg)?;
    std::fs::write(path, raw)?;
    Ok(())
}

pub fn remember(path: &Path, name: &str) -> Result<()> {
    let mut cfg = load();
    let path_str = path.to_string_lossy().to_string();
    cfg.recent.retain(|r| r.path != path_str);
    cfg.recent.insert(
        0,
        RecentWorkspace {
            path: path_str,
            name: name.to_string(),
            last_opened: Utc::now().to_rfc3339(),
        },
    );
    cfg.recent.truncate(MAX_RECENT);
    save(&cfg)?;
    Ok(())
}

pub fn forget(path: &Path) -> Result<()> {
    let mut cfg = load();
    let path_str = path.to_string_lossy().to_string();
    cfg.recent.retain(|r| r.path != path_str);
    save(&cfg)?;
    Ok(())
}

pub fn list_recent() -> Vec<RecentWorkspace> {
    let cfg = load();
    // Prune entries whose folder no longer exists so the onboarding list stays honest.
    cfg.recent
        .into_iter()
        .filter(|r| Path::new(&r.path).exists())
        .collect()
}
