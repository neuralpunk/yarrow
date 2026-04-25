// yarrow-server REST client. Confined to this module so the rest of
// the codebase keeps treating git as the only sync path — the
// yarrow-server integration just wraps "set up a git remote with
// friendly UX" plus the three REST calls needed to mint / revoke a
// PAT and create a vault.
//
// See `desktop-integration-spec.md` §4–§5 for the full contract.

use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use ureq::{Agent, AgentBuilder};

use crate::error::{Result, YarrowError};

// REST endpoints all live under `/api/v1/`. Git lives under `/git/`.
const API_PREFIX: &str = "/api/v1";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

/// Outcome of the email+password login → PAT exchange. The password is
/// never returned — it's used once to open a session cookie, the token
/// is minted, then we log out. The caller stores `token` (encrypted)
/// and the rest in the workspace config.
///
/// E2E mode (spec §8.1 option 3): we also derive the X25519 privkey
/// locally from the password + server-supplied envelope and return the
/// raw bytes so the caller can stash them in `AppState.session` for
/// later /workspaces/:id/unlock calls. The server never sees the
/// unwrapped privkey.
#[derive(Debug)]
pub struct ConnectOutcome {
    pub pat_id: String,
    pub pat_label: String,
    pub token: String,
    /// 32-byte X25519 private key derived from the user's password.
    /// `None` when the server returned an older /auth/login that
    /// doesn't include envelope fields — in that case /unlock won't
    /// work and the caller should surface a "server too old" error.
    pub server_privkey: Option<[u8; 32]>,
    pub server_pubkey: Option<[u8; 32]>,
}

/// Shape of `/auth/login` / `/auth/signup` / `/me` response after the
/// E2E pivot. The `*_b64` fields are the user's envelope material; the
/// client unwraps the privkey locally.
#[derive(Debug, Deserialize)]
struct MeResponseDto {
    #[allow(dead_code)]
    id: String,
    #[allow(dead_code)]
    email: String,
    #[serde(default)]
    encrypted_private_key_b64: Option<String>,
    #[serde(default)]
    kek_salt_b64: Option<String>,
    #[serde(default)]
    kek_params_json: Option<String>,
    #[serde(default)]
    public_key_b64: Option<String>,
}

/// What the server returns on `POST /api/v1/tokens`.
#[derive(Debug, Deserialize)]
struct TokenCreateResponse {
    id: String,
    token: String,
    #[serde(default)]
    label: Option<String>,
}

/// What the server returns on `POST /api/v1/workspaces`.
#[derive(Debug, Deserialize)]
pub struct WorkspaceCreateResponse {
    pub id: String,
    #[serde(default)]
    pub git_url: Option<String>,
}

/// Envelope for `/api/v1/*` JSON errors (server spec §6.2).
#[derive(Debug, Deserialize)]
struct ErrorEnvelope {
    #[serde(default)]
    error: ErrorBody,
}

#[derive(Debug, Default, Deserialize)]
struct ErrorBody {
    #[serde(default)]
    #[allow(dead_code)]
    code: String,
    #[serde(default)]
    message: String,
}

fn agent(insecure: bool) -> Agent {
    let mut b = AgentBuilder::new()
        .timeout_connect(REQUEST_TIMEOUT)
        .timeout_read(REQUEST_TIMEOUT)
        .timeout_write(REQUEST_TIMEOUT);
    if insecure {
        b = b.tls_config(build_insecure_tls_config());
    }
    b.build()
}

/// A rustls `ClientConfig` that accepts every certificate without
/// verification. Dev-only — the `WorkspaceServerConfig
/// .insecure_skip_tls_verify` flag is how this ever becomes active.
/// Never construct this on the happy path. `pub(crate)` so the
/// WebSocket client can reuse the same accept-everything verifier
/// when the user has knowingly enabled the dev escape hatch.
pub(crate) fn build_insecure_tls_config() -> Arc<rustls::ClientConfig> {
    // Pin an explicit ring provider rather than relying on the
    // process-default: ureq installs one at first-call time, not at
    // module load, so a `ClientConfig::builder()` issued before any
    // ureq call could otherwise panic.
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let cfg = rustls::ClientConfig::builder_with_provider(provider.clone())
        .with_safe_default_protocol_versions()
        .expect("rustls: safe default protocol versions")
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerify { provider }))
        .with_no_client_auth();
    Arc::new(cfg)
}

/// Accept-everything verifier. `verify_server_cert` returns an empty
/// `ServerCertVerified` token regardless of what the server presents.
/// `verify_tls12_signature` / `verify_tls13_signature` defer to the
/// underlying crypto provider so TLS still runs — we're only skipping
/// the PKI checks, not the handshake.
#[derive(Debug)]
struct NoVerify {
    provider: Arc<rustls::crypto::CryptoProvider>,
}

impl rustls::client::danger::ServerCertVerifier for NoVerify {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls_pki_types::CertificateDer<'_>,
        _intermediates: &[rustls_pki_types::CertificateDer<'_>],
        _server_name: &rustls_pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls_pki_types::UnixTime,
    ) -> std::result::Result<
        rustls::client::danger::ServerCertVerified,
        rustls::Error,
    > {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &rustls_pki_types::CertificateDer<'_>,
        dss: &rustls::DigitallySignedStruct,
    ) -> std::result::Result<
        rustls::client::danger::HandshakeSignatureValid,
        rustls::Error,
    > {
        rustls::crypto::verify_tls12_signature(
            message,
            cert,
            dss,
            &self.provider.signature_verification_algorithms,
        )
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &rustls_pki_types::CertificateDer<'_>,
        dss: &rustls::DigitallySignedStruct,
    ) -> std::result::Result<
        rustls::client::danger::HandshakeSignatureValid,
        rustls::Error,
    > {
        rustls::crypto::verify_tls13_signature(
            message,
            cert,
            dss,
            &self.provider.signature_verification_algorithms,
        )
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        self.provider
            .signature_verification_algorithms
            .supported_schemes()
    }
}

/// ureq's default build doesn't ship a cookie jar, and we don't want
/// to pull in `cookie_store` just to carry one value across three
/// requests. Parse every `Set-Cookie` off the login response into the
/// `name=value` pairs we need to replay on the follow-up /tokens and
/// /auth/logout calls.
fn collect_cookie_header(resp: &ureq::Response) -> Option<String> {
    let all: Vec<String> = resp
        .all("set-cookie")
        .into_iter()
        .filter_map(|raw| raw.split(';').next().map(|s| s.trim().to_string()))
        .filter(|pair| !pair.is_empty())
        .collect();
    if all.is_empty() {
        None
    } else {
        Some(all.join("; "))
    }
}

/// Normalize a user-typed server URL. Trims trailing slashes and
/// requires an explicit `http(s)` scheme so we never accidentally hit a
/// relative path.
pub fn normalize_server_url(raw: &str) -> Result<String> {
    let trimmed = raw.trim().trim_end_matches('/').to_string();
    if trimmed.is_empty() {
        return Err(YarrowError::Invalid("server URL is empty".into()));
    }
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err(YarrowError::Invalid(
            "server URL must start with http:// or https://".into(),
        ));
    }
    Ok(trimmed)
}

/// Translate a ureq error into a user-facing Yarrow error message.
/// Keeps operator-facing specifics (HTTP code, body fragments) inside
/// the string so logs / devtools stay grep-able, but phrases the
/// message in the Yarrow terminology.
fn user_message_for_status(code: u16, url: &str) -> String {
    match code {
        401 => "Sign-in failed — check your email, password, or access token.".into(),
        403 => {
            "You don't have permission to use this server. Ask an admin to invite you, or pick a different server."
                .into()
        }
        404 => format!("That server didn't recognise the request ({url}). Double-check the URL."),
        423 => "This workspace is locked on the server. Sign in on the web to unlock it.".into(),
        429 => "The server is throttling sign-ins. Wait a minute and try again.".into(),
        500..=599 => "The server hit a snag. Try again in a moment.".into(),
        _ => format!("Unexpected response from the server (HTTP {code})."),
    }
}

fn parse_error_body(body: &str) -> Option<String> {
    serde_json::from_str::<ErrorEnvelope>(body)
        .ok()
        .map(|e| e.error.message)
        .filter(|m| !m.is_empty())
}

/// Try the email + password path: open a session, mint a PAT, log
/// out, discard the password. On success the caller has a token it
/// can pass to git HTTP Basic for every subsequent `/git/<id>.git`
/// request. Nothing but the PAT + its id is ever persisted.
pub fn exchange_password_for_pat(
    server_url: &str,
    email: &str,
    password: &str,
    label: &str,
    insecure_tls: bool,
) -> Result<ConnectOutcome> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);

    // 1) Sign in — server replies with a Set-Cookie session token.
    let login_url = format!("{base}{API_PREFIX}/auth/login");
    let login_body = serde_json::json!({ "email": email, "password": password });
    let login_resp = match agent
        .post(&login_url)
        .set("Content-Type", "application/json")
        .send_string(&login_body.to_string())
    {
        Ok(r) => r,
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly = parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            return Err(YarrowError::Other(friendly));
        }
        Err(e) => {
            return Err(YarrowError::Other(format!(
                "Couldn't reach the server — check your internet connection and URL. ({e})"
            )));
        }
    };
    let cookie_header = collect_cookie_header(&login_resp).ok_or_else(|| {
        YarrowError::Other(
            "The server accepted your sign-in but didn't hand back a session. Check the server version, or try the 'Paste an access token' path.".into(),
        )
    })?;
    // Parse envelope material out of the login body so we can derive
    // the X25519 privkey locally. E2E: the server never holds the
    // unwrapped privkey anymore; it lives in AppState.session until
    // sign-out or app quit.
    //
    // Errors bubble up instead of silently falling through to "no
    // privkey" — without this, a JSON parse failure or a server that
    // omitted the envelope fields both ended at the same "reconnect to
    // unlock" cliff with no way to tell the user why.
    let login_body_text = login_resp.into_string().unwrap_or_default();
    let me_dto: MeResponseDto = serde_json::from_str(&login_body_text).map_err(|e| {
        eprintln!("[yarrow] login response parse failed: {e}; body head: {:.200}", login_body_text);
        YarrowError::Other(format!(
            "Signed in, but couldn't read the server's response ({e}). \
             Your server may be older than this desktop version — upgrade the server."
        ))
    })?;
    if me_dto.encrypted_private_key_b64.is_none()
        || me_dto.kek_salt_b64.is_none()
        || me_dto.kek_params_json.is_none()
        || me_dto.public_key_b64.is_none()
    {
        return Err(YarrowError::Other(
            "Signed in, but the server didn't return envelope material. \
             This happens when the server is older than v0.4 (E2E pivot) — \
             upgrade yarrow-server and try again."
                .into(),
        ));
    }
    let (server_privkey, server_pubkey) = unwrap_server_privkey(&me_dto, password)
        .map_err(|e| {
            YarrowError::Other(format!(
                "Signed in, but couldn't derive your workspace key locally: {e}. \
                 Your server may be older than this desktop version — upgrade the \
                 server or contact support."
            ))
        })?;

    // 2) Mint a PAT. The session cookie we just collected authorises
    // this call; without it the server returns 401.
    let tokens_url = format!("{base}{API_PREFIX}/tokens");
    let token_body = serde_json::json!({ "label": label });
    let token_resp: TokenCreateResponse = match agent
        .post(&tokens_url)
        .set("Content-Type", "application/json")
        .set("Cookie", &cookie_header)
        .send_string(&token_body.to_string())
    {
        Ok(r) => {
            let body = r.into_string().map_err(|e| {
                YarrowError::Other(format!("couldn't read the server's token response: {e}"))
            })?;
            serde_json::from_str(&body).map_err(|e| {
                YarrowError::Other(format!("server returned an unexpected token response: {e}"))
            })?
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            // Best effort: log out so we don't leave a dangling session.
            let _ = agent
                .post(&format!("{base}{API_PREFIX}/auth/logout"))
                .set("Cookie", &cookie_header)
                .call();
            let friendly = parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            return Err(YarrowError::Other(friendly));
        }
        Err(e) => {
            let _ = agent
                .post(&format!("{base}{API_PREFIX}/auth/logout"))
                .set("Cookie", &cookie_header)
                .call();
            return Err(YarrowError::Other(format!(
                "Lost the connection while creating an access token ({e})."
            )));
        }
    };

    // 3) Log out to invalidate the session server-side. The cookie
    // header goes out of scope right after this function returns.
    let _ = agent
        .post(&format!("{base}{API_PREFIX}/auth/logout"))
        .set("Cookie", &cookie_header)
        .call();

    let pat_label = token_resp.label.unwrap_or_else(|| label.to_string());

    Ok(ConnectOutcome {
        pat_id: token_resp.id,
        pat_label,
        token: token_resp.token,
        server_privkey,
        server_pubkey,
    })
}

/// Derive the X25519 keypair from the user's password + the envelope
/// material the server returned in `/auth/login`. Returns `(None, None)`
/// when the server didn't include envelope fields (old server or no
/// key material on the account yet).
fn unwrap_server_privkey(
    dto: &MeResponseDto,
    password: &str,
) -> anyhow::Result<(Option<[u8; 32]>, Option<[u8; 32]>)> {
    use base64::Engine as _;
    let b64 = base64::engine::general_purpose::STANDARD;
    let (Some(enc), Some(salt), Some(params), Some(pub_b64)) = (
        dto.encrypted_private_key_b64.as_deref(),
        dto.kek_salt_b64.as_deref(),
        dto.kek_params_json.as_deref(),
        dto.public_key_b64.as_deref(),
    ) else {
        return Ok((None, None));
    };
    let params = crate::server_crypto::KekParams::from_json(params)?;
    let salt = b64.decode(salt.as_bytes())?;
    let enc = b64.decode(enc.as_bytes())?;
    let pub_bytes = b64.decode(pub_b64.as_bytes())?;
    if pub_bytes.len() != crate::server_crypto::PUBLIC_KEY_LEN {
        anyhow::bail!("public key length mismatch");
    }
    let kek = crate::server_crypto::derive_kek(password.as_bytes(), &salt, params)?;
    let priv_bytes = crate::server_crypto::aead_open(&kek, &enc)
        .map_err(|e| anyhow::anyhow!("unwrap privkey: {e}"))?;
    if priv_bytes.len() != crate::server_crypto::PRIVATE_KEY_LEN {
        anyhow::bail!("private key length mismatch");
    }
    let mut priv_arr = [0u8; 32];
    priv_arr.copy_from_slice(&priv_bytes);
    let mut pub_arr = [0u8; 32];
    pub_arr.copy_from_slice(&pub_bytes);
    Ok((Some(priv_arr), Some(pub_arr)))
}

/// Token-path E2E bootstrap. Given a working PAT and the user's
/// password, call `/me` (PAT-authenticated) to fetch the envelope
/// material, then derive the X25519 privkey locally. Mirrors what
/// `exchange_password_for_pat` does on the password path — the
/// difference is the auth credential used to hit /me. `Ok(None)`
/// when the server isn't returning envelope fields (pre-E2E).
pub fn derive_server_privkey_via_me(
    server_url: &str,
    email: &str,
    pat: &str,
    password: &str,
    insecure_tls: bool,
) -> Result<Option<([u8; 32], [u8; 32])>> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let auth = basic_auth_header(email, pat);
    let me_url = format!("{base}{API_PREFIX}/me");
    let resp = agent
        .get(&me_url)
        .set("Authorization", &auth)
        .call()
        .map_err(|e| {
            YarrowError::Other(format!(
                "Couldn't reach {me_url} with the supplied token ({e})."
            ))
        })?;
    let body = resp
        .into_string()
        .map_err(|e| YarrowError::Other(format!("read /me body: {e}")))?;
    let dto: MeResponseDto = serde_json::from_str(&body)
        .map_err(|e| YarrowError::Other(format!("parse /me: {e}")))?;
    if dto.encrypted_private_key_b64.is_none()
        || dto.kek_salt_b64.is_none()
        || dto.kek_params_json.is_none()
        || dto.public_key_b64.is_none()
    {
        return Ok(None);
    }
    let (priv_b, pub_b) =
        unwrap_server_privkey(&dto, password).map_err(|e| YarrowError::Other(e.to_string()))?;
    match (priv_b, pub_b) {
        (Some(p), Some(k)) => Ok(Some((p, k))),
        _ => Ok(None),
    }
}

/// E2E unlock: GET the caller's wrapped DEK from the server, unwrap it
/// locally using the privkey that `exchange_password_for_pat` put into
/// AppState, and POST the raw DEK to `/workspaces/:id/unlock`. Subsequent
/// /git/ calls from this PAT will see the workspace as unlocked server-
/// side until `/lock`, logout, or the idle sweep fires.
///
/// Call this once per sync session — before each `sync_to_server`.
/// Idempotent on the server side (same session re-unlocking is a no-op
/// aside from a touch of the activity timer).
pub fn unlock_workspace_on_server(
    server_url: &str,
    email: &str,
    pat: &str,
    workspace_id: &str,
    privkey: &[u8; 32],
    pubkey: &[u8; 32],
    insecure_tls: bool,
) -> Result<()> {
    use base64::Engine as _;
    let b64 = base64::engine::general_purpose::STANDARD;
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let auth = basic_auth_header(email, pat);

    // 1. Fetch the ECIES-wrapped DEK.
    let wrapped_url = format!(
        "{base}{API_PREFIX}/workspaces/{}/wrapped-dek",
        urlencoding(workspace_id)
    );
    let resp = match agent
        .get(&wrapped_url)
        .set("Authorization", &auth)
        .call()
    {
        Ok(r) => r,
        Err(ureq::Error::Status(404, _)) => {
            // Remote workspace gone — surface so cmd_sync can recover
            // by re-creating and updating workspace_id in config.
            return Err(YarrowError::RemoteWorkspaceGone);
        }
        Err(e) => {
            return Err(YarrowError::Other(format!(
                "Couldn't fetch the workspace key envelope — is the server reachable? ({e})"
            )));
        }
    };
    #[derive(Deserialize)]
    struct WrappedDekResp {
        wrapped_dek_b64: String,
    }
    let body = resp
        .into_string()
        .map_err(|e| YarrowError::Other(format!("read wrapped-dek body: {e}")))?;
    let wrapped: WrappedDekResp = serde_json::from_str(&body)
        .map_err(|e| YarrowError::Other(format!("parse wrapped-dek: {e}")))?;
    let wrapped_bytes = b64
        .decode(wrapped.wrapped_dek_b64.as_bytes())
        .map_err(|e| YarrowError::Other(format!("decode wrapped DEK: {e}")))?;

    // 2. Unwrap locally.
    let dek = crate::server_crypto::pk_open(privkey, pubkey, &wrapped_bytes)
        .map_err(|e| YarrowError::Other(format!("unwrap workspace key locally: {e}")))?;
    if dek.len() != 32 {
        return Err(YarrowError::Other(
            "Unwrapped workspace key is the wrong size — possible corruption on the server.".into(),
        ));
    }

    // 3. POST the raw DEK to /unlock. Server installs it into the
    //    session keyring and (when fscrypt is wired) the kernel keyring.
    let unlock_url = format!(
        "{base}{API_PREFIX}/workspaces/{}/unlock",
        urlencoding(workspace_id)
    );
    let unlock_body = serde_json::json!({ "dek_b64": b64.encode(&dek) });
    let resp = agent
        .post(&unlock_url)
        .set("Authorization", &auth)
        .set("Content-Type", "application/json")
        .send_string(&unlock_body.to_string());
    // Best-effort zero of the DEK we just sent.
    drop(dek);
    match resp {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly =
                parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            Err(YarrowError::Other(friendly))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server to unlock the workspace ({e})."
        ))),
    }
}

fn urlencoding(s: &str) -> String {
    // Cheap URL path-segment escape good enough for UUIDs. We never
    // feed non-ASCII here.
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || "-._~".contains(c) {
                c.to_string()
            } else {
                format!("%{:02X}", c as u8)
            }
        })
        .collect()
}

/// "Paste a PAT" path. There's no handy REST call that authenticates
/// with a bare PAT (the API is session-auth), so we probe a git URL
/// the server is guaranteed to host: `/git/<random>.git`. Anything
/// other than a clean 401 means the credential was accepted by the
/// server — 404 ("valid auth, no such vault") is the happy signal
/// this function looks for.
pub fn test_pat(server_url: &str, email: &str, token: &str, insecure_tls: bool) -> Result<()> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);

    // Any random-but-well-formed uuid. The path will 404 for anyone
    // authenticated; the server spec guarantees 401 for unauthenticated.
    let probe_uuid = "00000000-0000-0000-0000-000000000000";
    let probe_url = format!("{base}/git/{probe_uuid}.git/info/refs?service=git-upload-pack");
    let basic = basic_auth_header(email, token);
    match agent.get(&probe_url).set("Authorization", &basic).call() {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(404, _)) => Ok(()),
        Err(ureq::Error::Status(401, _)) => Err(YarrowError::Other(
            "Your email + access token pair was rejected by the server.".into(),
        )),
        Err(ureq::Error::Status(code, _)) => {
            Err(YarrowError::Other(user_message_for_status(code, &base)))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server — {e}"
        ))),
    }
}

/// Find a server-side workspace whose name exactly matches the local
/// workspace's name. Used to prevent duplicate-create races on first
/// sync after a disconnect/reconnect/delete cycle: if the user already
/// owns a "One month in Europe" workspace on the server, we adopt it
/// rather than POSTing a second one that ends up as a visible twin on
/// the dashboard.
///
/// Returns `Ok(None)` when no match exists. Errors only on network /
/// auth failures — an empty list is a normal "no match" result.
pub fn find_workspace_by_name(
    server_url: &str,
    email: &str,
    token: &str,
    name: &str,
    insecure_tls: bool,
) -> Result<Option<WorkspaceCreateResponse>> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let url = format!("{base}{API_PREFIX}/workspaces");
    let basic = basic_auth_header(email, token);
    match agent.get(&url).set("Authorization", &basic).call() {
        Ok(r) => {
            let body = r.into_string().map_err(|e| {
                YarrowError::Other(format!("couldn't read the server's workspace list: {e}"))
            })?;
            #[derive(Deserialize)]
            struct Row {
                id: String,
                name: String,
                #[serde(default)]
                git_url: Option<String>,
            }
            let rows: Vec<Row> = serde_json::from_str(&body)
                .map_err(|e| YarrowError::Other(format!("unexpected workspace list: {e}")))?;
            let target = name.trim();
            for row in rows {
                if row.name.trim() == target {
                    return Ok(Some(WorkspaceCreateResponse {
                        id: row.id,
                        git_url: row.git_url,
                    }));
                }
            }
            Ok(None)
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly =
                parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            Err(YarrowError::Other(friendly))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server to list workspaces — {e}"
        ))),
    }
}

/// Call `POST /api/v1/workspaces` with HTTP Basic (email:PAT). Returns the
/// server-assigned workspace uuid. Used on first sync when the user hasn't
/// yet associated the local workspace with one on the server.
pub fn create_workspace(
    server_url: &str,
    email: &str,
    token: &str,
    name: &str,
    insecure_tls: bool,
) -> Result<WorkspaceCreateResponse> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let url = format!("{base}{API_PREFIX}/workspaces");
    let basic = basic_auth_header(email, token);
    let body = serde_json::json!({ "name": name });
    match agent
        .post(&url)
        .set("Content-Type", "application/json")
        .set("Authorization", &basic)
        .send_string(&body.to_string())
    {
        Ok(r) => {
            let body = r.into_string().map_err(|e| {
                YarrowError::Other(format!("couldn't read the server's workspace response: {e}"))
            })?;
            serde_json::from_str::<WorkspaceCreateResponse>(&body)
                .map_err(|e| YarrowError::Other(format!("unexpected workspace response: {e}")))
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly = parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            Err(YarrowError::Other(friendly))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server to create a workspace on it — {e}"
        ))),
    }
}

/// Revoke a PAT on the server. Best-effort — the caller always clears
/// local state regardless of the outcome so a dead server doesn't
/// leave the UI stuck in "connected" forever.
pub fn revoke_pat(
    server_url: &str,
    email: &str,
    token: &str,
    pat_id: &str,
    insecure_tls: bool,
) -> Result<()> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let url = format!("{base}{API_PREFIX}/tokens/{pat_id}");
    let basic = basic_auth_header(email, token);
    match agent.delete(&url).set("Authorization", &basic).call() {
        Ok(_) => Ok(()),
        // `/api/v1/*` is session-authenticated, not PAT-authenticated.
        // A 401 here means the DELETE refused Basic auth — the PAT is
        // still live and the caller should surface that so the user
        // knows to revoke it in the web UI.
        Err(ureq::Error::Status(401, _)) => Err(YarrowError::Other(
            "The server only accepts revocation while signed in on the web. Open it in your browser to finish.".into(),
        )),
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly = parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            Err(YarrowError::Other(friendly))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server to revoke the token — {e}"
        ))),
    }
}

/// Server-side shape of `GET /api/v1/workspaces/:id/quota`. Mirrors
/// `yarrow-server/src/api/workspaces.rs::QuotaProbe` — if the server
/// changes one, this needs to change too. All bytes are i64 because
/// that's what the server's SQLite schema stores `disk_bytes` as, and
/// optional because an uncapped workspace / user is represented by
/// `null` rather than a sentinel.
#[derive(Debug, Clone, Deserialize)]
pub struct QuotaProbe {
    pub used: i64,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub remaining: Option<i64>,
    pub user_used: i64,
    #[serde(default)]
    pub user_limit: Option<i64>,
    #[serde(default)]
    pub user_remaining: Option<i64>,
    #[serde(default)]
    pub sync_blocked: bool,
    #[serde(default)]
    pub hysteresis_threshold_bytes: Option<i64>,
}

impl QuotaProbe {
    /// Minimum of workspace-remaining and user-remaining, in bytes. The
    /// pre-push check compares the estimated pack size against this —
    /// whichever cap is tighter wins. `None` when neither the workspace
    /// nor the user has an effective cap.
    pub fn tightest_remaining_bytes(&self) -> Option<u64> {
        let to_u64 = |v: i64| v.max(0) as u64;
        match (self.remaining, self.user_remaining) {
            (Some(a), Some(b)) => Some(to_u64(a.min(b))),
            (Some(a), None) => Some(to_u64(a)),
            (None, Some(b)) => Some(to_u64(b)),
            (None, None) => None,
        }
    }
}

/// Cheap GET against `/api/v1/workspaces/:id/quota`. Returns a
/// point-in-time snapshot of per-workspace and per-user byte usage +
/// caps. The pre-push check in `cmd_sync` calls this, compares against
/// `estimate_push_size`, and aborts locally (with a named-culprit
/// SyncOutcome) when the push would exceed the tightest remaining cap
/// — avoiding the old "upload gigabytes, get 413, try again" cycle.
///
/// Auth: HTTP Basic `email:PAT`, same as every other desktop-side REST
/// call. The server's `CurrentUser` extractor accepts either a session
/// cookie or a Basic PAT, so the same endpoint serves both clients.
pub fn fetch_quota(
    server_url: &str,
    email: &str,
    token: &str,
    workspace_id: &str,
    insecure_tls: bool,
) -> Result<QuotaProbe> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let url = format!("{base}{API_PREFIX}/workspaces/{workspace_id}/quota");
    let basic = basic_auth_header(email, token);
    match agent.get(&url).set("Authorization", &basic).call() {
        Ok(r) => {
            let body = r
                .into_string()
                .map_err(|e| YarrowError::Other(format!("couldn't read quota response: {e}")))?;
            serde_json::from_str::<QuotaProbe>(&body)
                .map_err(|e| YarrowError::Other(format!("unexpected quota response: {e}")))
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly =
                parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            Err(YarrowError::Other(friendly))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server to check quota — {e}"
        ))),
    }
}

/// Row returned by `/api/v1/workspaces/:id/large-blobs`. Matches the
/// server-side `LargeBlobResponse`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LargeBlobEntry {
    pub oid: String,
    #[serde(default)]
    pub path: String,
    pub size: i64,
}

/// GET the top-N biggest blobs in a workspace's entire git history —
/// the "pick which files to permanently delete" picker. `paths` can
/// include deleted-but-still-in-history entries; that's the whole
/// point of the feature.
pub fn list_large_blobs(
    server_url: &str,
    email: &str,
    token: &str,
    workspace_id: &str,
    insecure_tls: bool,
) -> Result<Vec<LargeBlobEntry>> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let url = format!("{base}{API_PREFIX}/workspaces/{workspace_id}/large-blobs");
    let basic = basic_auth_header(email, token);
    match agent.get(&url).set("Authorization", &basic).call() {
        Ok(r) => {
            let body = r.into_string().map_err(|e| {
                YarrowError::Other(format!("couldn't read large-blob response: {e}"))
            })?;
            serde_json::from_str::<Vec<LargeBlobEntry>>(&body)
                .map_err(|e| YarrowError::Other(format!("unexpected large-blob response: {e}")))
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly =
                parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            Err(YarrowError::Other(friendly))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server to list large files — {e}"
        ))),
    }
}

/// Response from `/api/v1/workspaces/:id/reclaim-space`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ReclaimSpaceOutcome {
    pub bytes_before: u64,
    pub bytes_after: u64,
    pub bytes_freed: u64,
    #[serde(default)]
    pub new_head_sha: Option<String>,
    pub paths_purged: usize,
}

/// POST the reclaim-space request — permanently delete the named paths
/// and every revision of them from the workspace's history. Server
/// runs `git filter-repo` + `git gc` under an advisory lock, clears
/// quota lockout if the caller drops below 95 %, audit-logs the action,
/// and broadcasts `workspace.purged` to every member's WebSocket so
/// other devices force-reclone on their next sync.
pub fn reclaim_space(
    server_url: &str,
    email: &str,
    token: &str,
    workspace_id: &str,
    paths: &[String],
    expected_disk_bytes: Option<i64>,
    insecure_tls: bool,
) -> Result<ReclaimSpaceOutcome> {
    let base = normalize_server_url(server_url)?;
    let agent = agent(insecure_tls);
    let url = format!("{base}{API_PREFIX}/workspaces/{workspace_id}/reclaim-space");
    let basic = basic_auth_header(email, token);
    let body = serde_json::json!({
        "paths": paths,
        "expected_disk_bytes": expected_disk_bytes,
        "confirm": true,
    });
    match agent
        .post(&url)
        .set("Content-Type", "application/json")
        .set("Authorization", &basic)
        .send_string(&body.to_string())
    {
        Ok(r) => {
            let body = r.into_string().map_err(|e| {
                YarrowError::Other(format!("couldn't read reclaim response: {e}"))
            })?;
            serde_json::from_str::<ReclaimSpaceOutcome>(&body)
                .map_err(|e| YarrowError::Other(format!("unexpected reclaim response: {e}")))
        }
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            let friendly =
                parse_error_body(&body).unwrap_or_else(|| user_message_for_status(code, &base));
            Err(YarrowError::Other(friendly))
        }
        Err(e) => Err(YarrowError::Other(format!(
            "Couldn't reach the server to reclaim space — {e}"
        ))),
    }
}

/// Build the `/git/<workspace_id>.git` URL used for fetch + push once a
/// server-side workspace has been associated with this local one. Kept in
/// this module so the URL shape has a single source of truth.
pub fn git_url(server_url: &str, workspace_id: &str) -> Result<String> {
    let base = normalize_server_url(server_url)?;
    Ok(format!("{base}/git/{workspace_id}.git"))
}

fn basic_auth_header(email: &str, token: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let pair = format!("{email}:{token}");
    format!("Basic {}", STANDARD.encode(pair))
}
