//! Mirrors yarrow-server's `src/crypto.rs` primitives so the desktop
//! can derive the user's private key locally and unwrap workspace DEKs
//! without round-tripping through the server. Required for E2E mode
//! (spec §8.1 option 3): the server holds no privkey copy, so the
//! desktop reproduces the same argon2id / AEAD / ECIES that the server
//! uses to produce the wrap blobs it stores.
//!
//! Scope: one-way — desktop *opens* what the server *seals*. We don't
//! currently seal on the desktop (no "invite a member" desktop flow
//! yet). Keep this file small; if the API grows, match the server's
//! signatures byte-for-byte.

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Key as AeadKey, Nonce};
use hkdf::Hkdf;
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};

pub const PUBLIC_KEY_LEN: usize = 32;
pub const PRIVATE_KEY_LEN: usize = 32;
pub const DEK_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;
pub const TAG_LEN: usize = 16;

#[derive(Debug, Clone, Copy)]
pub struct KekParams {
    pub m_cost: u32,
    pub t_cost: u32,
    pub p_cost: u32,
}

impl KekParams {
    pub fn from_json(s: &str) -> anyhow::Result<Self> {
        #[derive(serde::Deserialize)]
        struct Raw {
            m_cost: u32,
            t_cost: u32,
            p_cost: u32,
        }
        let r: Raw = serde_json::from_str(s)?;
        Ok(Self {
            m_cost: r.m_cost,
            t_cost: r.t_cost,
            p_cost: r.p_cost,
        })
    }
}

pub fn derive_kek(
    password: &[u8],
    salt: &[u8],
    params: KekParams,
) -> anyhow::Result<[u8; 32]> {
    let argon_params = Params::new(params.m_cost, params.t_cost, params.p_cost, Some(32))
        .map_err(|e| anyhow::anyhow!("argon2 params: {e}"))?;
    let hasher = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);
    let mut out = [0u8; 32];
    hasher
        .hash_password_into(password, salt, &mut out)
        .map_err(|e| anyhow::anyhow!("argon2 derive: {e}"))?;
    Ok(out)
}

/// AEAD open for the layout `nonce(12) || ct || tag(16)`. Mirrors
/// `yarrow-server::crypto::aead_open`.
pub fn aead_open(key: &[u8; 32], sealed: &[u8]) -> anyhow::Result<Vec<u8>> {
    if sealed.len() < NONCE_LEN + TAG_LEN {
        anyhow::bail!("sealed blob too short");
    }
    let (nonce_bytes, ct) = sealed.split_at(NONCE_LEN);
    let cipher = ChaCha20Poly1305::new(AeadKey::from_slice(key));
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ct)
        .map_err(|_| anyhow::anyhow!("aead open failed"))
}

/// ECIES open: `eph_pub(32) || nonce(12) || ct || tag(16)` → plaintext.
/// Mirrors `yarrow-server::crypto::pk_open`.
pub fn pk_open(
    my_private: &[u8; PRIVATE_KEY_LEN],
    my_public: &[u8; PUBLIC_KEY_LEN],
    sealed: &[u8],
) -> anyhow::Result<Vec<u8>> {
    if sealed.len() < PUBLIC_KEY_LEN + NONCE_LEN + TAG_LEN {
        anyhow::bail!("pk sealed blob too short");
    }
    let (eph_pub_bytes, rest) = sealed.split_at(PUBLIC_KEY_LEN);
    let (nonce_bytes, ct) = rest.split_at(NONCE_LEN);

    let secret = StaticSecret::from(*my_private);
    let mut eph_pub = [0u8; PUBLIC_KEY_LEN];
    eph_pub.copy_from_slice(eph_pub_bytes);
    let eph_public = PublicKey::from(eph_pub);
    let shared = secret.diffie_hellman(&eph_public);

    let sym_key = derive_ecies_key(&eph_pub, my_public, shared.as_bytes());
    let cipher = ChaCha20Poly1305::new(AeadKey::from_slice(&sym_key));
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ct)
        .map_err(|_| anyhow::anyhow!("pk_open: aead decrypt failed"))
}

fn derive_ecies_key(
    ephemeral_pub: &[u8; PUBLIC_KEY_LEN],
    recipient_pub: &[u8; PUBLIC_KEY_LEN],
    shared: &[u8],
) -> [u8; 32] {
    let mut salt = [0u8; PUBLIC_KEY_LEN * 2];
    salt[..PUBLIC_KEY_LEN].copy_from_slice(ephemeral_pub);
    salt[PUBLIC_KEY_LEN..].copy_from_slice(recipient_pub);

    let hk = Hkdf::<Sha256>::new(Some(&salt), shared);
    let mut out = [0u8; 32];
    hk.expand(b"yarrow-dek-wrap-v1", &mut out)
        .expect("hkdf expand");
    out
}
