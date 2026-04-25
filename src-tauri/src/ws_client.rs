// Desktop WebSocket client for yarrow-server's `/ws` push stream.
//
// Server-side `src/ws.rs` broadcasts `workspace.updated` events whenever a
// push lands on `/git/<workspace_id>.git/`. The web client already
// subscribes via the browser WebSocket. Desktop was the last piece — it
// did nothing with the stream, which is why a push from the web never
// surfaced on desktop until a manual Sync.
//
// This module owns one task per active workspace-with-server-config. On
// workspace open / connect the task starts; on disconnect / close / swap
// it's cancelled via a `tokio::sync::Notify`. The task opens the WS with
// HTTP-Basic auth (the same `email:PAT` the git proxy uses — the
// `CurrentUser` extractor on `/ws` accepts both session cookies and
// PATs), reads frames in a loop, and re-emits each typed JSON message
// as a Tauri event with the channel name = the JSON `type` field.
// Reconnects on drop with exponential back-off; the frontend's existing
// `subscribe("workspace.updated", …)` path picks them up unchanged.

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};

use base64::Engine as _;
use futures_util::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter};
use tokio::time::{Duration, Instant, sleep};
use tokio_tungstenite::Connector;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::protocol::Message;

/// One-per-process manager. Tracks the currently-running listener so
/// `cmd_server_connect_*` / `cmd_server_disconnect` / `cmd_open_workspace`
/// can hand off without races. Uses `std::sync::Mutex` rather than the
/// tokio variant so synchronous Tauri commands can call `restart`/`stop`
/// without having to be rewritten as async.
#[derive(Default, Clone)]
pub struct Manager {
    inner: Arc<Mutex<Option<Handle>>>,
}

struct Handle {
    cancel: Arc<AtomicBool>,
}

impl Manager {
    /// Replace the running listener (if any) with a new one pointed at
    /// `server_url` + authenticated as `email` / `pat`. Safe to call
    /// repeatedly — any prior task is signalled to exit before the new
    /// one starts. Returns immediately; the task runs in the background.
    pub fn restart(
        &self,
        server_url: String,
        email: String,
        pat: String,
        insecure_skip_tls_verify: bool,
        app: AppHandle,
    ) {
        self.stop();

        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut guard = match self.inner.lock() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            *guard = Some(Handle {
                cancel: cancel.clone(),
            });
        }

        tauri::async_runtime::spawn(listen_loop(
            server_url,
            email,
            pat,
            insecure_skip_tls_verify,
            app,
            cancel,
        ));
    }

    /// Signal the running task to exit on its next loop iteration.
    /// Returns immediately; the task's shutdown is eventually consistent.
    pub fn stop(&self) {
        let taken = {
            let mut guard = match self.inner.lock() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            guard.take()
        };
        if let Some(h) = taken {
            h.cancel.store(true, Ordering::SeqCst);
        }
    }
}

async fn listen_loop(
    server_url: String,
    email: String,
    pat: String,
    insecure_skip_tls_verify: bool,
    app: AppHandle,
    cancel: Arc<AtomicBool>,
) {
    // Convert the http(s):// base into a ws(s):// WebSocket URL. Trailing
    // slashes from well-meaning user-pasted URLs are trimmed so we don't
    // build `wss://host//ws` and fail the upgrade.
    let base = server_url.trim_end_matches('/');
    let ws_url = if let Some(rest) = base.strip_prefix("https://") {
        format!("wss://{rest}/ws")
    } else if let Some(rest) = base.strip_prefix("http://") {
        format!("ws://{rest}/ws")
    } else {
        tracing_style_log(
            "ws_client",
            &format!("unsupported server URL scheme: {server_url}"),
        );
        return;
    };

    let credentials = base64::engine::general_purpose::STANDARD
        .encode(format!("{email}:{pat}").as_bytes());

    let mut backoff_secs: u64 = 1;
    while !cancel.load(Ordering::SeqCst) {
        match connect_once(&ws_url, &credentials, insecure_skip_tls_verify, &app, &cancel).await {
            Ok(()) => {
                // Clean close from the server side (e.g. restart). Brief
                // pause before we try to reconnect so we don't hammer a
                // server that's rolling.
                backoff_secs = 1;
                sleep(Duration::from_secs(1)).await;
            }
            Err(e) => {
                tracing_style_log("ws_client", &format!("connect error: {e}; will retry in {backoff_secs}s"));
                // Cancellable sleep — check the flag each second so a
                // disconnect doesn't get stuck waiting out a long back-off.
                for _ in 0..backoff_secs {
                    if cancel.load(Ordering::SeqCst) {
                        return;
                    }
                    sleep(Duration::from_secs(1)).await;
                }
                backoff_secs = (backoff_secs * 2).min(60);
            }
        }
    }
}

async fn connect_once(
    ws_url: &str,
    credentials: &str,
    insecure_skip_tls_verify: bool,
    app: &AppHandle,
    cancel: &AtomicBool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // tokio-tungstenite's connect_async + IntoClientRequest lets us
    // attach the Authorization header that the server's CurrentUser
    // extractor accepts (Basic email:PAT mode).
    let mut req = ws_url.into_client_request()?;
    req.headers_mut().insert(
        "authorization",
        format!("Basic {credentials}").parse()?,
    );

    // Honour `insecure_skip_tls_verify` here the same way the ureq HTTP
    // path does. Without this the dev escape hatch worked for REST but
    // silently failed for the push stream — REST would sync, but
    // workspace.updated events from a self-signed server would never
    // arrive on desktop. We reuse the exact NoVerify config from
    // `server.rs` so behaviour stays consistent across both transports.
    let (ws_stream, _response) = if insecure_skip_tls_verify {
        let connector = Connector::Rustls(crate::server::build_insecure_tls_config());
        tokio_tungstenite::connect_async_tls_with_config(req, None, false, Some(connector)).await?
    } else {
        tokio_tungstenite::connect_async(req).await?
    };
    let (mut sink, mut stream) = ws_stream.split();

    // Heartbeat + liveness. The server is passive on pings, but a
    // ping every 30s keeps NATs / proxies from idling out the TCP
    // session. The pong is best-effort: if any frame at all (data,
    // pong, server-initiated ping) arrives we count the link as live.
    //
    // If we go DEAD_AFTER without seeing anything, we force-break so
    // the outer loop's back-off reconnect kicks in. Without this we
    // would sit on a half-open socket — the OS won't surface a TCP
    // RST on a passive route until the keepalive timeout (often
    // multiple minutes), so a workspace.updated event published in
    // that window never reaches the desktop.
    const PING_EVERY: Duration = Duration::from_secs(30);
    const DEAD_AFTER: Duration = Duration::from_secs(75);
    let mut ping = tokio::time::interval(PING_EVERY);
    ping.tick().await; // drop the first immediate tick
    let mut last_seen = Instant::now();

    loop {
        tokio::select! {
            frame = stream.next() => {
                last_seen = Instant::now();
                match frame {
                    Some(Ok(Message::Text(text))) => {
                        forward_event(app, text.as_ref());
                    }
                    Some(Ok(Message::Binary(_))) => { /* ignore */ }
                    Some(Ok(Message::Ping(p))) => { let _ = sink.send(Message::Pong(p)).await; }
                    Some(Ok(Message::Pong(_))) => {}
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Frame(_))) => {}
                    Some(Err(e)) => return Err(Box::new(e)),
                }
            },
            _ = ping.tick() => {
                if last_seen.elapsed() >= DEAD_AFTER {
                    tracing_style_log(
                        "ws_client",
                        "no frames in 75s; assuming link is dead, reconnecting",
                    );
                    break;
                }
                if sink.send(Message::Ping(Vec::new().into())).await.is_err() {
                    break;
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(500)) => {
                if cancel.load(Ordering::SeqCst) { break; }
            }
        }
    }
    let _ = sink.close().await;
    Ok(())
}

fn forward_event(app: &AppHandle, text: &str) {
    // Parse enough to extract the `type` field, then re-emit to the
    // frontend via a Tauri event channel of the same name. This matches
    // the shape the existing desktop transport wrapper expects:
    // `listen("workspace.updated", handler)` in `lib/transport/tauri.ts`
    // already converts Tauri events into the `subscribe()` callback the
    // workspace view wires up.
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(text) else {
        return;
    };
    // Copy the channel out as an owned String so we can move `parsed`
    // into `emit` below without tripping the borrow checker.
    let Some(channel) = parsed
        .get("type")
        .and_then(|v| v.as_str())
        .map(String::from)
    else {
        return;
    };
    // Skip the server's `hello` greeting — it's for the browser's UI
    // only and the desktop has no interest in echoing it.
    if channel == "hello" {
        return;
    }
    let _ = app.emit(&channel, parsed);
}

fn tracing_style_log(target: &str, message: &str) {
    // Desktop doesn't ship the `tracing` crate yet; plain eprintln keeps
    // us aligned with how `server.rs` already surfaces net errors.
    eprintln!("[{target}] {message}");
}
