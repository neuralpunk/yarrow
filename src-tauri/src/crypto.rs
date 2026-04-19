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

// Argon2id defaults — conservative ≈250ms on a modern laptop, well clear of
// the OWASP floor of (m=19 MiB, t=2). If a future machine finds these too
// slow we can expose tuning; for now fixed so a workspace opened on any
// device produces the same derived key.
pub const ARGON2_M_COST: u32 = 65_536; // 64 MiB
pub const ARGON2_T_COST: u32 = 3;
pub const ARGON2_P_COST: u32 = 1;
pub const ARGON2_VERSION: u32 = 0x13; // Argon2 v1.3

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

/// Derive a 32-byte key from (password, salt) via Argon2id.
pub fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    let params = Params::new(
        ARGON2_M_COST,
        ARGON2_T_COST,
        ARGON2_P_COST,
        Some(KEY_LEN),
    )
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
        let pw_key = derive_key(password, &salt)?;
        let plain = open(&pw_key, &nonce, &wrapped)
            .map_err(|_| CryptoError::InvalidPassword)?;
        to_master_key(plain)
    }

    pub fn unlock_with_recovery(&self, phrase: &str) -> Result<MasterKey> {
        validate_phrase(phrase)?;
        let salt = decode_b64(&self.recovery_salt, "recovery_salt")?;
        let nonce = decode_nonce(&self.recovery_wrap_nonce, "recovery_wrap_nonce")?;
        let wrapped = decode_b64(&self.recovery_wrapped_key, "recovery_wrapped_key")?;
        let rk = derive_recovery_key(phrase, &salt)?;
        let plain = open(&rk, &nonce, &wrapped)
            .map_err(|_| CryptoError::InvalidPhrase)?;
        to_master_key(plain)
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
    derive_key_bytes(&input, salt)
}

/// Argon2id over raw bytes (used for recovery path — phrase is pre-seeded).
fn derive_key_bytes(input: &[u8; 32], salt: &[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    let params = Params::new(ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST, Some(KEY_LEN))
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
