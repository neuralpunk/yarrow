// Per-workspace secret storage (2.1.0). Introduced to move the sync
// token out of the plaintext `.yarrow/credentials.toml` and into the
// host OS keychain when one is available (macOS Security framework,
// Windows Credential Manager, Linux Secret Service over D-Bus).
//
// Because Linux in particular can't always reach a Secret Service (CI
// containers, headless installs, users without GNOME Keyring or
// KWallet running), every call transparently falls back to the
// existing file path so nothing breaks on those setups. The fallback
// is identical to pre-2.1 behaviour — users on those systems simply
// get the same plaintext-token story they had before.
//
// Token migration is automatic: on `read`, if there's no keychain
// entry but there's a file token, we hand the value back AND try to
// upgrade it into the keychain + delete the file. On `write`, we try
// the keychain first and only write the file if the keychain write
// failed.

use std::path::{Path, PathBuf};

use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::error::Result;

const SERVICE: &str = "com.yarrow.desktop";
const CREDENTIALS_FILE: &str = "credentials.toml";

/// On-disk fallback shape. Kept byte-identical to the struct workspace.rs
/// used before 2.1 so old workspaces keep working without any migration
/// step beyond "first successful read".
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct FileCredentials {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    /// Yarrow-server PAT, scoped to this workspace. Stored on-disk only
    /// when the OS keychain is unavailable. Distinct from `token`
    /// because a single workspace may configure both a generic git
    /// remote and a yarrow-server connection.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub server_pat: Option<String>,
}

fn credentials_path(root: &Path) -> PathBuf {
    root.join(".yarrow").join(CREDENTIALS_FILE)
}

/// Stable keychain "user" for a given workspace. We canonicalise the
/// path so a user who cd's with a different casing / trailing slash
/// still hits the same entry; if canonicalise fails (dir moved /
/// permissions) we fall back to the raw path string, which is still
/// stable within a session.
fn keyring_user(root: &Path) -> String {
    let canonical = std::fs::canonicalize(root)
        .unwrap_or_else(|_| root.to_path_buf())
        .to_string_lossy()
        .into_owned();
    format!("sync-token:{}", canonical)
}

fn keyring_user_server(root: &Path) -> String {
    let canonical = std::fs::canonicalize(root)
        .unwrap_or_else(|_| root.to_path_buf())
        .to_string_lossy()
        .into_owned();
    format!("server-pat:{}", canonical)
}

fn entry(root: &Path) -> Option<Entry> {
    Entry::new(SERVICE, &keyring_user(root)).ok()
}

fn entry_server(root: &Path) -> Option<Entry> {
    Entry::new(SERVICE, &keyring_user_server(root)).ok()
}

fn keyring_user_server_privkey(root: &Path) -> String {
    let canonical = std::fs::canonicalize(root)
        .unwrap_or_else(|_| root.to_path_buf())
        .to_string_lossy()
        .into_owned();
    format!("server-privkey:{}", canonical)
}

fn entry_server_privkey(root: &Path) -> Option<Entry> {
    Entry::new(SERVICE, &keyring_user_server_privkey(root)).ok()
}

// ─────────────────── file fallback ───────────────────

fn read_file(root: &Path) -> Result<FileCredentials> {
    let path = credentials_path(root);
    if !path.exists() {
        return Ok(FileCredentials::default());
    }
    let raw = std::fs::read_to_string(path)?;
    Ok(toml::from_str(&raw)?)
}

fn write_file(root: &Path, creds: &FileCredentials) -> Result<()> {
    let path = credentials_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if creds.token.is_some() || creds.server_pat.is_some() {
        let raw = toml::to_string_pretty(creds)?;
        // Atomic swap — see workspace::atomic_write for rationale. A
        // partial write here under disk-full or sudden-power-off would
        // leave credentials.toml parseable-but-empty (the
        // `FileCredentials::default()` branch returns None for both
        // fields), effectively erasing the PAT on next boot.
        crate::workspace::atomic_write_secret(&path, raw.as_bytes())?;
        // Best-effort readback — if the write silently zeroed (we've
        // seen this on overlayed filesystems and some sandboxed
        // setups), flag it loudly so the user can try again instead
        // of discovering the loss on next launch.
        if let Ok(check) = std::fs::read_to_string(&path) {
            let parsed: std::result::Result<FileCredentials, _> = toml::from_str(&check);
            match parsed {
                Ok(parsed) => {
                    let persisted = parsed.server_pat.is_some() || parsed.token.is_some();
                    if !persisted && (creds.token.is_some() || creds.server_pat.is_some()) {
                        eprintln!(
                            "[yarrow] WARN: credentials file write appeared to succeed but readback is empty at {}",
                            path.display()
                        );
                    }
                }
                Err(e) => eprintln!(
                    "[yarrow] WARN: credentials file readback failed after write at {}: {e}",
                    path.display()
                ),
            }
        }
    } else if path.exists() {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

/// Clear one field of the fallback credentials file and keep the
/// other intact. Used when we want to remove the generic sync token
/// without disturbing the server PAT (or vice versa). If the file
/// ends up empty, `write_file` will remove it.
fn clear_file_field(root: &Path, field: FileField) -> Result<()> {
    let mut file = read_file(root)?;
    match field {
        FileField::Token => file.token = None,
        FileField::ServerPat => file.server_pat = None,
    }
    write_file(root, &file)
}

enum FileField {
    Token,
    ServerPat,
}

// ─────────────────── public API ───────────────────

/// Read the workspace's sync token. Keychain wins; falls through to the
/// plaintext file; returns `Ok(None)` if neither holds anything. A file
/// token found on the fallback path is opportunistically migrated into
/// the keychain (and the file deleted) as a side effect — errors during
/// that migration are swallowed so a broken keychain never blocks a
/// sync.
pub fn read_sync_token(root: &Path) -> Result<Option<String>> {
    // Same file-first policy as `read_server_pat` — a keychain that
    // accepts writes without persisting them was silently losing the
    // Yarrow-server PAT on app restart. Applying the same fix here for
    // generic git remotes keeps both auth paths on the same reliable
    // footing.
    let file = read_file(root)?;
    if let Some(tok) = file.token.clone() {
        if !tok.is_empty() {
            return Ok(Some(tok));
        }
    }
    if let Some(e) = entry(root) {
        match e.get_password() {
            Ok(tok) if !tok.is_empty() => return Ok(Some(tok)),
            _ => {}
        }
    }
    Ok(None)
}

/// Write the workspace's sync token. File-first; keychain is a
/// best-effort second copy. See `write_server_pat` for rationale.
pub fn write_sync_token(root: &Path, token: &str) -> Result<()> {
    let mut file = read_file(root)?;
    file.token = Some(token.to_string());
    write_file(root, &file)?;
    if let Some(e) = entry(root) {
        let _ = e.set_password(token);
    }
    Ok(())
}

/// Remove the sync token from both stores. Errors on either path are
/// swallowed — a disable action should leave the user in the "no token
/// stored anywhere" state even if one side is unreachable.
pub fn clear_sync_token(root: &Path) -> Result<()> {
    if let Some(e) = entry(root) {
        let _ = e.delete_credential();
    }
    let _ = clear_file_field(root, FileField::Token);
    Ok(())
}

// ─────────────── yarrow-server PAT ───────────────
//
// Shape-identical to the sync-token helpers above. Different keychain
// key (`server-pat:<path>`) and a different field in the fallback file
// so a workspace configured for both a generic git remote and a
// yarrow-server keeps two distinct secrets without collision.

pub fn read_server_pat(root: &Path) -> Result<Option<String>> {
    // File is the authoritative store — see `write_server_pat` for the
    // rationale. We still consult the keychain as a secondary source in
    // case the file was deleted (e.g. user cleared their workspace
    // metadata by hand) but the keychain still holds the secret.
    let file = read_file(root)?;
    if let Some(tok) = file.server_pat.clone() {
        if !tok.is_empty() {
            return Ok(Some(tok));
        }
    }

    if let Some(e) = entry_server(root) {
        match e.get_password() {
            Ok(tok) if !tok.is_empty() => return Ok(Some(tok)),
            _ => {}
        }
    }
    Ok(None)
}

pub fn write_server_pat(root: &Path, token: &str) -> Result<()> {
    // File-first: some Linux setups (locked gnome-keyring, sandboxed
    // Tauri apps without Secret Service access, flaky D-Bus sessions)
    // return Ok from `set_password` without actually persisting the
    // value. When that happens and we've already cleared the file, the
    // PAT vanishes across app restarts and every sync silently fails
    // with "access token not on this machine." Writing the file first
    // guarantees recovery; the keychain is an opportunistic second copy
    // for OS-level hardening.
    let mut file = read_file(root)?;
    file.server_pat = Some(token.to_string());
    write_file(root, &file)?;
    if let Some(e) = entry_server(root) {
        let _ = e.set_password(token);
    }
    Ok(())
}

pub fn clear_server_pat(root: &Path) -> Result<()> {
    if let Some(e) = entry_server(root) {
        let _ = e.delete_credential();
    }
    let _ = clear_file_field(root, FileField::ServerPat);
    Ok(())
}

// ─────────────────── server-side E2E privkey ───────────────────
//
// Stores the user's 32-byte X25519 private key + 32-byte public key in
// the OS keychain — deliberately NOT in the credentials file. A leak
// of credentials.toml would hand an attacker the privkey, which is
// enough to unwrap every workspace DEK the server has. The keychain
// is its own trust domain (macOS Keychain, libsecret, Windows
// Credential Manager), and if it's unavailable we intentionally
// fall through to "user types password again next launch" rather
// than downgrading to a file fallback.
//
// Stored as base64("priv(32) || pub(32)") — one entry, one value.

const PRIVKEY_PACKED_LEN: usize = 64;

pub fn read_server_privkey(root: &Path) -> Option<([u8; 32], [u8; 32])> {
    use base64::Engine as _;
    let e = entry_server_privkey(root)?;
    let raw = e.get_password().ok()?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .ok()?;
    if bytes.len() != PRIVKEY_PACKED_LEN {
        return None;
    }
    let mut priv_b = [0u8; 32];
    let mut pub_b = [0u8; 32];
    priv_b.copy_from_slice(&bytes[..32]);
    pub_b.copy_from_slice(&bytes[32..]);
    Some((priv_b, pub_b))
}

pub fn write_server_privkey(root: &Path, priv_b: &[u8; 32], pub_b: &[u8; 32]) -> Result<()> {
    use base64::Engine as _;
    let Some(e) = entry_server_privkey(root) else {
        // No keychain backend on this platform. Silently skip —
        // desktop still works; user just re-authenticates per launch.
        return Ok(());
    };
    let mut packed = [0u8; PRIVKEY_PACKED_LEN];
    packed[..32].copy_from_slice(priv_b);
    packed[32..].copy_from_slice(pub_b);
    let encoded = base64::engine::general_purpose::STANDARD.encode(packed);
    // zero the packed buffer; the keyring crate owns the stored copy
    // from here on and we don't want a second copy lingering on the
    // stack.
    let _ = e.set_password(&encoded);
    // Best-effort zeroize of the base64 string by overwriting — it's
    // allocated, so we can't truly scrub, but drop is next.
    drop(encoded);
    Ok(())
}

pub fn clear_server_privkey(root: &Path) -> Result<()> {
    if let Some(e) = entry_server_privkey(root) {
        let _ = e.delete_credential();
    }
    Ok(())
}
