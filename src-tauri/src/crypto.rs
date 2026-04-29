// Yarrow's encryption primitives. The only module that imports
// `chacha20poly1305`, `argon2`, or `bip39`. Everything elsewhere goes through
// the `encrypt_body` / `decrypt_body` / `EnvelopeBlob` / `WorkspaceEnvelope`
// helpers below — the same pattern as `git2::` → `git.rs`.
//
// Crypto model (per spec §Local encryption):
// • Per-note body encryption with **ChaCha20-Poly1305** (AEAD).
// • Workspace holds a 32-byte **master key** (random at enable time).
// • The master key wraps two ways inside `.yarrow/security.toml`:
//     (a) by a password-derived key via **Argon2id**, and
//     (b) by a recovery-phrase-derived key (BIP39 12-word, second recipient).
// • Every encrypted note records its own random 12-byte nonce. Nonces are
//   unique per encryption, never reused.
// • All key material is wrapped in `Zeroizing<_>` so buffers are wiped on drop.

use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use bip39::{Language, Mnemonic};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng as AeadOsRng},
    AeadCore, ChaCha20Poly1305, Key, Nonce,
};
use rand::{rngs::OsRng as RandOsRng, RngCore};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, Zeroizing};

use crate::error::{Result, YarrowError};

pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;
pub const SALT_LEN: usize = 16;

// Argon2id defaults. As of 2026, OWASP's password-storage cheat sheet
// recommends a baseline ≥(m=19 MiB, t=2, p=1); contemporary guidance for
// desktop apps with infrequent unlocks is to push memory considerably
// higher than the baseline because memory-hardness is the only thing
// that meaningfully raises the cost of a bulk-GPU/ASIC offline attack.
//
// Yarrow ships at (m=128 MiB, t=4, p=1) — roughly 500–700ms on a modern
// laptop and noticeably more on a budget device, but unlock is
// per-session and the user only feels it once. Older workspaces created
// at the legacy (m=64 MiB, t=3, p=1) unlock with their stored params
// (the envelope records m_cost / t_cost / p_cost / argon2_version) and
// then transparently re-derive and re-wrap with the current params via
// `WorkspaceEnvelope::migrate_to_current_params` — see the call site in
// `commands::cmd_unlock_encryption` and `cmd_recover_encryption`.
pub const ARGON2_M_COST: u32 = 131_072; // 128 MiB
pub const ARGON2_T_COST: u32 = 4;
pub const ARGON2_P_COST: u32 = 1;
pub const ARGON2_VERSION: u32 = 0x13; // Argon2 v1.3

/// Tuple form of the current parameters for callers that read the
/// envelope's stored values. Kept in lockstep with the constants above
/// so any future bump only needs to be made in one place.
pub fn current_params() -> (u32, u32, u32) {
    (ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST)
}

#[derive(Debug)]
pub enum CryptoError {
    InvalidPassword,
    InvalidPhrase,
    CipherFailure,
    BadPayload(String),
    Argon2(String),
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::InvalidPassword => write!(f, "wrong password"),
            CryptoError::InvalidPhrase => write!(f, "recovery phrase didn't match this workspace"),
            CryptoError::CipherFailure => write!(f, "decryption failed — data was modified or the key is wrong"),
            CryptoError::BadPayload(s) => write!(f, "malformed encrypted payload: {}", s),
            CryptoError::Argon2(s) => write!(f, "key derivation failed: {}", s),
        }
    }
}

impl From<CryptoError> for YarrowError {
    fn from(e: CryptoError) -> Self { YarrowError::Crypto(e.to_string()) }
}

/// Master key for a workspace. Wrapped in `Zeroizing` so a `Drop` zeroes it.
pub type MasterKey = Zeroizing<[u8; KEY_LEN]>;

pub fn random_master_key() -> MasterKey {
    let mut key = [0u8; KEY_LEN];
    RandOsRng.fill_bytes(&mut key);
    Zeroizing::new(key)
}

pub fn random_bytes(n: usize) -> Vec<u8> {
    let mut v = vec![0u8; n];
    RandOsRng.fill_bytes(&mut v);
    v
}

/// Derive a 32-byte key from (password, salt) via Argon2id at the
/// **current** parameters. Use [`derive_key_with_params`] when unlocking
/// an existing envelope so the derivation matches the params the
/// envelope was created with.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    derive_key_with_params(password, salt, ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST)
}

/// Like [`derive_key`] but lets the caller pin the Argon2id cost
/// parameters. Required for unlocking a workspace whose envelope was
/// written under older parameters than the current constants.
pub fn derive_key_with_params(
    password: &str,
    salt: &[u8],
    m_cost: u32,
    t_cost: u32,
    p_cost: u32,
) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    let params = Params::new(m_cost, t_cost, p_cost, Some(KEY_LEN))
        .map_err(|e| CryptoError::Argon2(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = Zeroizing::new([0u8; KEY_LEN]);
    argon2
        .hash_password_into(password.as_bytes(), salt, out.as_mut())
        .map_err(|e| CryptoError::Argon2(e.to_string()))?;
    Ok(out)
}

fn cipher(key: &[u8; KEY_LEN]) -> ChaCha20Poly1305 {
    ChaCha20Poly1305::new(Key::from_slice(key))
}

pub fn random_nonce() -> [u8; NONCE_LEN] {
    let n = ChaCha20Poly1305::generate_nonce(&mut AeadOsRng);
    let mut out = [0u8; NONCE_LEN];
    out.copy_from_slice(n.as_slice());
    out
}

/// Encrypt with a fresh random nonce. Returns (nonce, ciphertext).
pub fn seal(key: &[u8; KEY_LEN], plaintext: &[u8]) -> Result<([u8; NONCE_LEN], Vec<u8>)> {
    let nonce = random_nonce();
    let ct = cipher(key)
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|_| CryptoError::CipherFailure)?;
    Ok((nonce, ct))
}

pub fn open(key: &[u8; KEY_LEN], nonce: &[u8; NONCE_LEN], ciphertext: &[u8]) -> Result<Vec<u8>> {
    cipher(key)
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| CryptoError::CipherFailure.into())
}

// ── Note-body envelope ────────────────────────────────────────────────────
//
// On-disk shape: a single base64-encoded blob that replaces the body. We keep
// nonce + ciphertext inline so a note file is self-describing; the workspace
// salt/kdf sit in frontmatter for transparency but the envelope itself is
// closed under (nonce, ct).

#[derive(Debug, Clone)]
pub struct BodyEnvelope {
    pub nonce: [u8; NONCE_LEN],
    pub ciphertext: Vec<u8>,
}

impl BodyEnvelope {
    pub fn seal(key: &[u8; KEY_LEN], plaintext: &str) -> Result<Self> {
        let (nonce, ciphertext) = seal(key, plaintext.as_bytes())?;
        Ok(Self { nonce, ciphertext })
    }
    pub fn open(&self, key: &[u8; KEY_LEN]) -> Result<String> {
        let pt = open(key, &self.nonce, &self.ciphertext)?;
        String::from_utf8(pt).map_err(|_| CryptoError::CipherFailure.into())
    }
    pub fn nonce_b64(&self) -> String { STANDARD.encode(self.nonce) }
    pub fn ciphertext_b64(&self) -> String { STANDARD.encode(&self.ciphertext) }
}

// ── Workspace envelope (security.toml) ────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WorkspaceEnvelope {
    pub enabled: bool,
    pub kdf: String,
    pub m_cost: u32,
    pub t_cost: u32,
    pub p_cost: u32,
    pub argon2_version: u32,
    pub password_salt: String,           // base64
    pub password_wrap_nonce: String,     // base64
    pub password_wrapped_key: String,    // base64
    pub recovery_salt: String,           // base64
    pub recovery_wrap_nonce: String,     // base64
    pub recovery_wrapped_key: String,    // base64
}

impl WorkspaceEnvelope {
    /// Create a brand-new envelope. Returns the envelope, the master key
    /// (caller holds in memory until lock), and the recovery phrase (shown
    /// to the user ONCE and never persisted).
    pub fn create(password: &str) -> Result<(Self, MasterKey, String)> {
        let master = random_master_key();

        let password_salt = random_bytes(SALT_LEN);
        let password_key = derive_key(password, &password_salt)?;
        let (p_nonce, p_wrapped) = seal(&password_key, master.as_ref())?;

        let phrase = generate_phrase()?;
        let recovery_salt = random_bytes(SALT_LEN);
        let recovery_key = derive_recovery_key(&phrase, &recovery_salt)?;
        let (r_nonce, r_wrapped) = seal(&recovery_key, master.as_ref())?;

        let env = WorkspaceEnvelope {
            enabled: true,
            kdf: "argon2id".into(),
            m_cost: ARGON2_M_COST,
            t_cost: ARGON2_T_COST,
            p_cost: ARGON2_P_COST,
            argon2_version: ARGON2_VERSION,
            password_salt: STANDARD.encode(&password_salt),
            password_wrap_nonce: STANDARD.encode(p_nonce),
            password_wrapped_key: STANDARD.encode(&p_wrapped),
            recovery_salt: STANDARD.encode(&recovery_salt),
            recovery_wrap_nonce: STANDARD.encode(r_nonce),
            recovery_wrapped_key: STANDARD.encode(&r_wrapped),
        };
        Ok((env, master, phrase))
    }

    pub fn unlock_with_password(&self, password: &str) -> Result<MasterKey> {
        let salt = decode_b64(&self.password_salt, "password_salt")?;
        let nonce = decode_nonce(&self.password_wrap_nonce, "password_wrap_nonce")?;
        let wrapped = decode_b64(&self.password_wrapped_key, "password_wrapped_key")?;
        // Use the params the envelope was created with — older
        // workspaces stored lower (m, t) values, and re-deriving with
        // today's higher params would produce a different key and a
        // spurious "wrong password" error. The migration step (if any)
        // is run by the IPC handler after a successful unlock.
        let pw_key = derive_key_with_params(
            password,
            &salt,
            self.m_cost,
            self.t_cost,
            self.p_cost,
        )?;
        let plain = open(&pw_key, &nonce, &wrapped)
            .map_err(|_| CryptoError::InvalidPassword)?;
        to_master_key(plain)
    }

    pub fn unlock_with_recovery(&self, phrase: &str) -> Result<MasterKey> {
        validate_phrase(phrase)?;
        let salt = decode_b64(&self.recovery_salt, "recovery_salt")?;
        let nonce = decode_nonce(&self.recovery_wrap_nonce, "recovery_wrap_nonce")?;
        let wrapped = decode_b64(&self.recovery_wrapped_key, "recovery_wrapped_key")?;
        let rk = derive_recovery_key_with_params(
            phrase,
            &salt,
            self.m_cost,
            self.t_cost,
            self.p_cost,
        )?;
        let plain = open(&rk, &nonce, &wrapped)
            .map_err(|_| CryptoError::InvalidPhrase)?;
        to_master_key(plain)
    }

    /// True when the envelope's stored Argon2id parameters lag behind
    /// the current constants. The unlock path checks this and, if true,
    /// re-derives both wraps under the current params and rewrites
    /// `security.toml` atomically. The user never sees the migration —
    /// the only externally visible effect is one slightly slower unlock.
    pub fn needs_migration(&self) -> bool {
        // Defensive lower-bound: never "migrate down" if a future build
        // somehow reads an envelope that already records *higher* params
        // than the current constants. That can happen if the user
        // downgraded the binary; treat their stored params as the floor.
        self.m_cost < ARGON2_M_COST
            || self.t_cost < ARGON2_T_COST
            || self.p_cost < ARGON2_P_COST
            || self.argon2_version != ARGON2_VERSION
            || self.kdf != "argon2id"
    }

    /// The password-wrap migration. Run from the IPC unlock handler
    /// after a successful `unlock_with_password` so we still have the
    /// user's password in scope. Re-derives the password key under the
    /// current params with a fresh salt, re-wraps the master, and bumps
    /// the stored params. Atomic-by-snapshot on error.
    pub fn migrate_password_wrap_with_password(
        &mut self,
        master: &MasterKey,
        password: &str,
    ) -> Result<()> {
        self.migrate_password_wrap_inner(master, |salt| {
            derive_key_with_params(password, salt, ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST)
        })
    }

    /// Inner migration with the derive step injected so tests can force
    /// a failure mid-migration and verify the snapshot rollback. Public
    /// callers use [`migrate_password_wrap_with_password`].
    fn migrate_password_wrap_inner(
        &mut self,
        master: &MasterKey,
        derive: impl FnOnce(&[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>>,
    ) -> Result<()> {
        if !self.needs_migration() {
            return Ok(());
        }
        let snapshot = self.clone();
        let try_migrate = || -> Result<()> {
            let new_salt = random_bytes(SALT_LEN);
            let new_key = derive(&new_salt)?;
            let (nonce, wrapped) = seal(&new_key, master.as_ref())?;
            self.password_salt = STANDARD.encode(&new_salt);
            self.password_wrap_nonce = STANDARD.encode(nonce);
            self.password_wrapped_key = STANDARD.encode(&wrapped);
            // Bump the recorded params LAST — only after the new wrap
            // is in place, so a crash mid-migration leaves the envelope
            // self-consistent (params still match the wrap that's there).
            self.kdf = "argon2id".into();
            self.argon2_version = ARGON2_VERSION;
            self.m_cost = ARGON2_M_COST;
            self.t_cost = ARGON2_T_COST;
            self.p_cost = ARGON2_P_COST;
            Ok(())
        };
        match try_migrate() {
            Ok(()) => Ok(()),
            Err(e) => {
                *self = snapshot;
                Err(e)
            }
        }
    }

    /// Recovery-wrap migration helper for the recovery-flow unlock.
    /// Same shape as [`migrate_password_wrap_with_password`] but uses
    /// the recovery phrase the user just typed.
    pub fn migrate_recovery_wrap_with_phrase(
        &mut self,
        master: &MasterKey,
        phrase: &str,
    ) -> Result<()> {
        self.migrate_recovery_wrap_inner(master, |salt| {
            derive_recovery_key_with_params(
                phrase,
                salt,
                ARGON2_M_COST,
                ARGON2_T_COST,
                ARGON2_P_COST,
            )
        })
    }

    fn migrate_recovery_wrap_inner(
        &mut self,
        master: &MasterKey,
        derive: impl FnOnce(&[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>>,
    ) -> Result<()> {
        if !self.needs_migration() {
            return Ok(());
        }
        let snapshot = self.clone();
        let try_migrate = || -> Result<()> {
            let new_salt = random_bytes(SALT_LEN);
            let new_key = derive(&new_salt)?;
            let (nonce, wrapped) = seal(&new_key, master.as_ref())?;
            self.recovery_salt = STANDARD.encode(&new_salt);
            self.recovery_wrap_nonce = STANDARD.encode(nonce);
            self.recovery_wrapped_key = STANDARD.encode(&wrapped);
            // We don't bump m/t/p here — the password-wrap migration
            // owns the bump because the password wrap is the canonical
            // params anchor. The recovery wrap inherits whatever the
            // password flow stamps on the envelope.
            Ok(())
        };
        match try_migrate() {
            Ok(()) => Ok(()),
            Err(e) => {
                *self = snapshot;
                Err(e)
            }
        }
    }

    /// Rewrap the master key with a new password. Recovery remains valid.
    pub fn rewrap_password(&mut self, master: &MasterKey, new_password: &str) -> Result<()> {
        let salt = random_bytes(SALT_LEN);
        let key = derive_key(new_password, &salt)?;
        let (nonce, wrapped) = seal(&key, master.as_ref())?;
        self.password_salt = STANDARD.encode(&salt);
        self.password_wrap_nonce = STANDARD.encode(nonce);
        self.password_wrapped_key = STANDARD.encode(&wrapped);
        Ok(())
    }

    /// Regenerate a new recovery phrase. Returns the new phrase (shown once).
    pub fn rewrap_recovery(&mut self, master: &MasterKey) -> Result<String> {
        let phrase = generate_phrase()?;
        let salt = random_bytes(SALT_LEN);
        let key = derive_recovery_key(&phrase, &salt)?;
        let (nonce, wrapped) = seal(&key, master.as_ref())?;
        self.recovery_salt = STANDARD.encode(&salt);
        self.recovery_wrap_nonce = STANDARD.encode(nonce);
        self.recovery_wrapped_key = STANDARD.encode(&wrapped);
        Ok(phrase)
    }

    /// The workspace-level salt echoed into every encrypted note's
    /// frontmatter so the file is self-describing.
    pub fn workspace_salt_b64(&self) -> &str { &self.password_salt }
}

/// 12-word BIP39 English phrase from 128 bits of OS entropy.
fn generate_phrase() -> Result<String> {
    let mut entropy = [0u8; 16];
    RandOsRng.fill_bytes(&mut entropy);
    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)
        .map_err(|e| YarrowError::Other(e.to_string()))?;
    let phrase = mnemonic.to_string();
    // Zero the local entropy buffer; the mnemonic keeps its own internal
    // copy that the library manages.
    entropy.zeroize();
    Ok(phrase)
}

fn derive_recovery_key(phrase: &str, salt: &[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    derive_recovery_key_with_params(phrase, salt, ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST)
}

fn derive_recovery_key_with_params(
    phrase: &str,
    salt: &[u8],
    m_cost: u32,
    t_cost: u32,
    p_cost: u32,
) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    let mnemonic = Mnemonic::parse_in_normalized(Language::English, phrase)
        .map_err(|_| CryptoError::InvalidPhrase)?;
    // BIP39 seed (PBKDF2-HMAC-SHA512, 2048 iters, 64 bytes) then Argon2id.
    // The two-step stretch costs almost nothing on top of Argon2 and gives
    // us BIP39-standard phrase handling.
    let seed = Zeroizing::new(mnemonic.to_seed(""));
    // Seed is 64 bytes; use its first 32 bytes as the password input to
    // Argon2id so the derivation matches the password flow's cost. Wrap the
    // local copy in `Zeroizing` so it's scrubbed when this frame unwinds.
    let mut input = Zeroizing::new([0u8; 32]);
    input.copy_from_slice(&seed[..32]);
    derive_key_bytes_with_params(&input, salt, m_cost, t_cost, p_cost)
}

/// Argon2id over raw bytes (used for recovery path — phrase is pre-seeded).
fn derive_key_bytes_with_params(
    input: &[u8; 32],
    salt: &[u8],
    m_cost: u32,
    t_cost: u32,
    p_cost: u32,
) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    let params = Params::new(m_cost, t_cost, p_cost, Some(KEY_LEN))
        .map_err(|e| CryptoError::Argon2(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = Zeroizing::new([0u8; KEY_LEN]);
    argon2
        .hash_password_into(input, salt, out.as_mut())
        .map_err(|e| CryptoError::Argon2(e.to_string()))?;
    Ok(out)
}

fn validate_phrase(phrase: &str) -> Result<()> {
    Mnemonic::parse_in_normalized(Language::English, phrase)
        .map(|_| ())
        .map_err(|_| CryptoError::InvalidPhrase.into())
}

fn decode_b64(s: &str, label: &str) -> Result<Vec<u8>> {
    STANDARD
        .decode(s)
        .map_err(|_| CryptoError::BadPayload(label.into()).into())
}

fn decode_nonce(s: &str, label: &str) -> Result<[u8; NONCE_LEN]> {
    let bytes = decode_b64(s, label)?;
    if bytes.len() != NONCE_LEN {
        return Err(CryptoError::BadPayload(label.into()).into());
    }
    let mut out = [0u8; NONCE_LEN];
    out.copy_from_slice(&bytes);
    Ok(out)
}

fn to_master_key(plain: Vec<u8>) -> Result<MasterKey> {
    if plain.len() != KEY_LEN {
        return Err(CryptoError::BadPayload("master_key length".into()).into());
    }
    let mut key = [0u8; KEY_LEN];
    key.copy_from_slice(&plain);
    // The Vec is dropped here; scrub it first.
    let mut plain = plain;
    plain.zeroize();
    Ok(Zeroizing::new(key))
}

/// Helper for the frontmatter: decode the per-note nonce stored as base64.
pub fn decode_note_nonce(s: &str) -> Result<[u8; NONCE_LEN]> {
    decode_nonce(s, "note_nonce")
}

pub fn encode_bytes(b: &[u8]) -> String { STANDARD.encode(b) }
pub fn decode_bytes(s: &str) -> Result<Vec<u8>> { decode_b64(s, "ciphertext") }

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a "legacy" envelope at the pre-3.x parameters (m=64MiB,
    /// t=3, p=1) so we can exercise the migration path without
    /// committing fixture files.
    fn make_legacy_envelope(password: &str) -> (WorkspaceEnvelope, MasterKey, String) {
        let legacy_m = 65_536_u32;
        let legacy_t = 3_u32;
        let legacy_p = 1_u32;
        let master = random_master_key();

        let pw_salt = random_bytes(SALT_LEN);
        let pw_key =
            derive_key_with_params(password, &pw_salt, legacy_m, legacy_t, legacy_p).unwrap();
        let (p_nonce, p_wrapped) = seal(&pw_key, master.as_ref()).unwrap();

        let phrase = generate_phrase().unwrap();
        let r_salt = random_bytes(SALT_LEN);
        let r_key =
            derive_recovery_key_with_params(&phrase, &r_salt, legacy_m, legacy_t, legacy_p)
                .unwrap();
        let (r_nonce, r_wrapped) = seal(&r_key, master.as_ref()).unwrap();

        let env = WorkspaceEnvelope {
            enabled: true,
            kdf: "argon2id".into(),
            m_cost: legacy_m,
            t_cost: legacy_t,
            p_cost: legacy_p,
            argon2_version: ARGON2_VERSION,
            password_salt: STANDARD.encode(&pw_salt),
            password_wrap_nonce: STANDARD.encode(p_nonce),
            password_wrapped_key: STANDARD.encode(&p_wrapped),
            recovery_salt: STANDARD.encode(&r_salt),
            recovery_wrap_nonce: STANDARD.encode(r_nonce),
            recovery_wrapped_key: STANDARD.encode(&r_wrapped),
        };
        (env, master, phrase)
    }

    #[test]
    fn current_envelope_does_not_need_migration() {
        let (env, _, _) = WorkspaceEnvelope::create("hunter22-shop-cab").unwrap();
        assert!(!env.needs_migration());
    }

    #[test]
    fn legacy_envelope_needs_migration() {
        let (env, _, _) = make_legacy_envelope("password-1234567");
        assert!(env.needs_migration());
    }

    #[test]
    fn legacy_envelope_unlocks_with_password_under_legacy_params() {
        // Round-trip: a workspace created at legacy params must still
        // unlock with the same password — the unlock path is required
        // to use the params recorded on the envelope, not the current
        // constants.
        let pw = "hunter22-shop-cab";
        let (env, master, _) = make_legacy_envelope(pw);
        let unlocked = env.unlock_with_password(pw).expect("unlock should succeed");
        assert_eq!(unlocked.as_ref(), master.as_ref());
    }

    #[test]
    fn legacy_envelope_unlocks_with_recovery_phrase_under_legacy_params() {
        let pw = "hunter22-shop-cab";
        let (env, master, phrase) = make_legacy_envelope(pw);
        let unlocked = env
            .unlock_with_recovery(&phrase)
            .expect("recovery unlock should succeed");
        assert_eq!(unlocked.as_ref(), master.as_ref());
    }

    #[test]
    fn migrate_password_wrap_preserves_unlock_under_new_params() {
        // The full migration round-trip we ship in cmd_unlock_encryption:
        // unlock under legacy params, migrate the password wrap to
        // current params, and verify the user's same password unlocks
        // the migrated envelope.
        let pw = "hunter22-shop-cab";
        let (mut env, original_master, _) = make_legacy_envelope(pw);
        assert!(env.needs_migration());

        let unlocked = env.unlock_with_password(pw).unwrap();
        env.migrate_password_wrap_with_password(&unlocked, pw)
            .expect("migration should succeed");

        // Params are stamped to the current values.
        assert_eq!(env.m_cost, ARGON2_M_COST);
        assert_eq!(env.t_cost, ARGON2_T_COST);
        assert_eq!(env.p_cost, ARGON2_P_COST);
        assert!(!env.needs_migration());

        // Same password still unlocks, and the master key is identical
        // — the migration must never change which key the workspace
        // uses to decrypt its notes.
        let unlocked_after = env
            .unlock_with_password(pw)
            .expect("post-migration unlock with same password must succeed");
        assert_eq!(unlocked_after.as_ref(), original_master.as_ref());
    }

    #[test]
    fn migrate_password_wrap_with_wrong_password_does_not_match_unlock_after() {
        // Defensive: passing the wrong password to the migration path
        // would re-wrap the master under a key the user can't reproduce
        // — locking them out forever. This test verifies the migration
        // step itself doesn't blow up on a wrong password (it accepts
        // any string and just re-wraps), but the IPC handler only ever
        // calls migrate_password_wrap_with_password AFTER a successful
        // unlock, so in practice this can't happen. We assert behaviour
        // for the call site contract: migration completes, but the
        // resulting envelope unlocks with the *new* password instead of
        // the original. Documents that the IPC layer must guard this.
        let pw = "hunter22-shop-cab";
        let bogus_pw = "different-pw-9999";
        let (mut env, _master, _) = make_legacy_envelope(pw);
        let unlocked = env.unlock_with_password(pw).unwrap();
        env.migrate_password_wrap_with_password(&unlocked, bogus_pw)
            .expect("migration completes regardless of password value");

        // The original password no longer unlocks — this is the
        // hazard the IPC handler must avoid by only calling migrate
        // after a successful unlock with the SAME password.
        assert!(env.unlock_with_password(pw).is_err());
        // The wrong-but-passed-in password does unlock.
        assert!(env.unlock_with_password(bogus_pw).is_ok());
    }

    #[test]
    fn migrate_recovery_wrap_preserves_unlock_with_phrase() {
        // Mirror what cmd_recover_encryption does: migrate the recovery
        // wrap with the phrase, then migrate the password wrap with the
        // password (which is what bumps the (m,t,p) record). After the
        // pair, the envelope is consistent and `unlock_with_recovery`
        // derives with the new params and matches the new wrap.
        let pw = "hunter22-shop-cab";
        let (mut env, original_master, phrase) = make_legacy_envelope(pw);
        let unlocked = env.unlock_with_password(pw).unwrap();
        env.migrate_recovery_wrap_with_phrase(&unlocked, &phrase)
            .expect("recovery migration should succeed");
        env.migrate_password_wrap_with_password(&unlocked, pw)
            .expect("password migration should succeed");

        let unlocked_after = env
            .unlock_with_recovery(&phrase)
            .expect("recovery still unlocks after wrap migration");
        assert_eq!(unlocked_after.as_ref(), original_master.as_ref());
        assert!(!env.needs_migration());
    }

    #[test]
    fn recovery_wrap_alone_without_password_bump_unlocks_only_with_password() {
        // Documents the in-between state cmd_recover_encryption passes
        // through: between recovery_migrate (rewraps at new params) and
        // password rewrap+stamp, the params field still says legacy.
        // Recovery unlock during this window fails because it derives
        // at legacy params against a new-params wrap. The IPC handler
        // never persists this intermediate envelope — it always writes
        // after the password rewrap stamps the new params.
        let pw = "hunter22-shop-cab";
        let (mut env, _master, phrase) = make_legacy_envelope(pw);
        let unlocked = env.unlock_with_password(pw).unwrap();
        env.migrate_recovery_wrap_with_phrase(&unlocked, &phrase)
            .unwrap();
        // m/t/p still say legacy; recovery unlock derives with legacy
        // params which doesn't match the new wrap.
        assert!(env.unlock_with_recovery(&phrase).is_err());
    }

    #[test]
    fn migration_is_idempotent_when_already_at_current_params() {
        // Calling migrate_password_wrap_with_password on an envelope
        // that's already at current params is a no-op.
        let pw = "hunter22-shop-cab";
        let (mut env, _, _) = WorkspaceEnvelope::create(pw).unwrap();
        let snapshot_pw_salt = env.password_salt.clone();
        let snapshot_pw_wrapped = env.password_wrapped_key.clone();
        assert!(!env.needs_migration());

        let unlocked = env.unlock_with_password(pw).unwrap();
        env.migrate_password_wrap_with_password(&unlocked, pw)
            .unwrap();

        // Salt and wrap are unchanged because needs_migration was false.
        assert_eq!(env.password_salt, snapshot_pw_salt);
        assert_eq!(env.password_wrapped_key, snapshot_pw_wrapped);
    }

    #[test]
    fn migration_rolls_back_on_inner_error_via_snapshot() {
        // Inject a forced derive failure into the password-wrap
        // migration and assert the envelope is byte-identical to its
        // pre-migration state — proving the snapshot rollback works.
        let pw = "hunter22-shop-cab";
        let (mut env, _master, _) = make_legacy_envelope(pw);
        let unlocked = env.unlock_with_password(pw).unwrap();
        let pre = env.clone();
        let err = env
            .migrate_password_wrap_inner(&unlocked, |_salt| {
                Err(YarrowError::Crypto("forced failure for rollback test".into()))
            })
            .expect_err("forced derive failure should bubble up");
        assert!(format!("{}", err).contains("forced failure"));

        // Every field on the envelope is identical to the snapshot.
        assert_eq!(env.kdf, pre.kdf);
        assert_eq!(env.m_cost, pre.m_cost);
        assert_eq!(env.t_cost, pre.t_cost);
        assert_eq!(env.p_cost, pre.p_cost);
        assert_eq!(env.argon2_version, pre.argon2_version);
        assert_eq!(env.password_salt, pre.password_salt);
        assert_eq!(env.password_wrap_nonce, pre.password_wrap_nonce);
        assert_eq!(env.password_wrapped_key, pre.password_wrapped_key);
        assert_eq!(env.recovery_salt, pre.recovery_salt);
        assert_eq!(env.recovery_wrap_nonce, pre.recovery_wrap_nonce);
        assert_eq!(env.recovery_wrapped_key, pre.recovery_wrapped_key);

        // Critically: the user's original password STILL unlocks the
        // workspace after the failed migration. A buggy rollback would
        // leave the envelope in some intermediate state that no
        // password could open.
        assert!(env.unlock_with_password(pw).is_ok());
        assert!(env.needs_migration());
    }

    #[test]
    fn recovery_migration_rolls_back_on_inner_error_via_snapshot() {
        // Same shape as the password-wrap rollback test, against the
        // recovery wrap.
        let pw = "hunter22-shop-cab";
        let (mut env, _master, phrase) = make_legacy_envelope(pw);
        let unlocked = env.unlock_with_password(pw).unwrap();
        let pre = env.clone();
        let err = env
            .migrate_recovery_wrap_inner(&unlocked, |_salt| {
                Err(YarrowError::Crypto("forced failure".into()))
            })
            .expect_err("forced derive failure should bubble up");
        assert!(format!("{}", err).contains("forced failure"));
        assert_eq!(env.recovery_salt, pre.recovery_salt);
        assert_eq!(env.recovery_wrap_nonce, pre.recovery_wrap_nonce);
        assert_eq!(env.recovery_wrapped_key, pre.recovery_wrapped_key);
        // Recovery phrase still unlocks the workspace.
        assert!(env.unlock_with_recovery(&phrase).is_ok());
    }

    #[test]
    fn wrong_password_returns_invalid_password_not_panic() {
        let (env, _, _) = WorkspaceEnvelope::create("real-password").unwrap();
        let err = env.unlock_with_password("wrong-password").unwrap_err();
        // Surfaces as YarrowError::Crypto wrapping the InvalidPassword
        // case — the error string includes "wrong password".
        assert!(format!("{}", err).contains("wrong password"));
    }

    #[test]
    fn current_params_reports_constants() {
        assert_eq!(
            current_params(),
            (ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST)
        );
        // Sanity: enforce that we never drop below the OWASP floor in
        // a future bump. The cheat sheet's minimum is (m=19 MiB, t=2,
        // p=1); we should always be at least that.
        assert!(ARGON2_M_COST >= 19 * 1024);
        assert!(ARGON2_T_COST >= 2);
        assert!(ARGON2_P_COST >= 1);
    }
}
