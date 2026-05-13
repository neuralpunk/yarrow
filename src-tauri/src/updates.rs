//! GitHub-Releases-backed update check.
//!
//! Yarrow ships as a hand-rolled binary — no auto-update channel, no
//! background service. Settings → About has a button that calls into
//! this module to ask GitHub "what's the latest release?" so the user
//! can decide whether to fetch the new build themselves.
//!
//! Design constraints:
//!
//! * **Manual-only.** No auto-check on launch, no scheduled poll. The
//!   user clicks → we fire one HTTPS GET. Nothing happens otherwise.
//! * **No telemetry.** The only data that leaves the machine is the
//!   request itself (URL + a vanilla User-Agent). We do not send any
//!   workspace identifier, install id, or platform info beyond what's
//!   already implicit in the User-Agent string.
//! * **No version compare here.** We hand the raw tag back to the
//!   frontend and let it compare against `APP_VERSION`. Avoids
//!   reimplementing semver in Rust just for this.
//! * **Typed errors.** Every failure mode (DNS, timeout, 404, JSON
//!   parse) collapses into a `YarrowError::Other` with a short
//!   description — the UI shows a single generic "couldn't reach
//!   GitHub" line so we don't leak the user's network shape.
//!
//! Rate limit: GitHub allows 60 unauthenticated requests/hour per IP,
//! and a single button click costs one — comfortably under the cap.

use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::error::{Result, YarrowError};

const RELEASES_API: &str =
    "https://api.github.com/repos/neuralpunk/yarrow/releases/latest";

const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);

/// Cap the JSON body we read so a misconfigured proxy can't make us
/// pull a megabyte of HTML instead of GitHub's small release JSON.
/// A real GitHub release JSON is well under 32 KiB even with assets.
const MAX_BODY_BYTES: usize = 256 * 1024;

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    /// Latest release tag, with any leading "v"/"V" trimmed so the
    /// frontend can compare directly against `APP_VERSION` ("3.1.0").
    pub latest_version: String,
    /// Release title from GitHub (may differ from the tag — humans
    /// sometimes give releases a friendlier title than their tag).
    pub latest_name: Option<String>,
    /// Public release URL — what the "View release notes" link opens.
    pub release_url: String,
    /// ISO-8601 publish timestamp, when GitHub provides one.
    pub published_at: Option<String>,
}

pub fn check_for_updates() -> Result<UpdateInfo> {
    let agent = ureq::AgentBuilder::new()
        .timeout(REQUEST_TIMEOUT)
        // GitHub requires a User-Agent on every request — they 403
        // otherwise. We include the running version so a future
        // analytics question ("are users still on 2.x?") can be
        // answered server-side without us ever sending a separate
        // ping.
        .user_agent(concat!(
            "Yarrow/",
            env!("CARGO_PKG_VERSION"),
            " (+update-check)"
        ))
        .build();
    let resp = agent
        .get(RELEASES_API)
        .set("Accept", "application/vnd.github+json")
        // Pin to a known schema version so a future GitHub API rev
        // doesn't quietly change field names under us.
        .set("X-GitHub-Api-Version", "2022-11-28")
        .call()
        .map_err(|e| YarrowError::Other(format!("update check failed: {e}")))?;

    use std::io::Read;
    let mut body = String::new();
    resp.into_reader()
        .take(MAX_BODY_BYTES as u64)
        .read_to_string(&mut body)
        .map_err(|e| YarrowError::Other(format!("update check read failed: {e}")))?;

    let release: GitHubRelease = serde_json::from_str(&body)
        .map_err(|e| YarrowError::Other(format!("update check parse failed: {e}")))?;

    let latest = release
        .tag_name
        .trim_start_matches(|c: char| c == 'v' || c == 'V')
        .to_string();

    Ok(UpdateInfo {
        latest_version: latest,
        latest_name: release.name,
        release_url: release.html_url,
        published_at: release.published_at,
    })
}
