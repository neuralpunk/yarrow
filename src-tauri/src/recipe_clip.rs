//! 2.2.0 — Recipe URL clipper.
//!
//! Fetches a recipe-bearing web page, extracts schema.org `Recipe`
//! metadata from JSON-LD blocks, and renders it into the Yarrow
//! recipe-card kit shape so a baker can save a recipe from any food
//! blog without leaving the app.
//!
//! Most modern recipe blogs (NYT Cooking, King Arthur, Smitten Kitchen,
//! Serious Eats, AllRecipes, etc.) embed schema.org `Recipe` JSON-LD
//! because it's required for Google's rich results — so this is the
//! canonical extraction surface and works without per-site scrapers.
//!
//! Safety: this module makes outbound HTTP requests on the user's
//! behalf, so it follows the same SSRF-defence pattern as
//! `cmd_fetch_url_title` — only http(s), reject private/loopback hosts,
//! re-validate every redirect hop, cap the body size and timeout.
//! Different surface, same allowlist.

use crate::error::{Result, YarrowError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::net::IpAddr;
use std::time::Duration;

/// Plain shape of a clipped recipe — what the frontend renders into a
/// note. Strings rather than typed durations because schema.org
/// recipes are wildly inconsistent ("PT1H30M", "1 hour 30 minutes",
/// "1:30") and we'd rather pass through the source's own phrasing.
#[derive(Debug, Default, Serialize, Deserialize, Clone)]
pub struct RecipeData {
    pub name: String,
    pub description: String,
    pub yield_: String,
    pub prep_time: String,
    pub cook_time: String,
    pub total_time: String,
    pub ingredients: Vec<String>,
    pub instructions: Vec<String>,
    pub category: String,
    pub author: String,
    pub image_url: String,
    pub source_url: String,
}

pub fn clip_from_url(url: &str) -> Result<RecipeData> {
    let html = fetch_html_safe(url)?;
    // Pass 1: schema.org JSON-LD. Cleanest source when available.
    let blocks = extract_jsonld_blocks(&html);
    for block in &blocks {
        if let Ok(parsed) = serde_json::from_str::<Value>(block) {
            if let Some(recipe) = find_recipe(&parsed) {
                return Ok(extract_recipe_data(recipe, url));
            }
        }
    }
    // Pass 2: microdata fallback. Older WordPress sites and a few
    // long-running food blogs (inspiredtaste.net, etc.) publish their
    // recipe data via `itemtype="…/Recipe"` blocks instead of (or in
    // addition to) JSON-LD. The microdata parse is fragile by
    // necessity — we use regex over the raw HTML rather than a full
    // DOM — but it covers the most common attribute layouts.
    if let Some(data) = extract_microdata(&html, url) {
        return Ok(data);
    }
    Err(YarrowError::Invalid(format!(
        "no recipe metadata found at {url} — site may not publish schema.org Recipe data"
    )))
}

/// Render a clipped recipe as a markdown body matching the
/// recipe-card kit shape so existing tooling (path forks, bibliography,
/// shopping list) just works.
pub fn render_markdown(data: &RecipeData) -> String {
    let mut out = String::new();
    out.push_str("---\n");
    out.push_str("tags: [recipe]\n");
    if !data.yield_.is_empty() {
        out.push_str(&format!("yield: {}\n", yaml_string(&data.yield_)));
    }
    if !data.prep_time.is_empty() {
        out.push_str(&format!("prep_time: {}\n", yaml_string(&humanise_duration(&data.prep_time))));
    }
    if !data.cook_time.is_empty() {
        out.push_str(&format!("bake_time: {}\n", yaml_string(&humanise_duration(&data.cook_time))));
    }
    if !data.total_time.is_empty() {
        out.push_str(&format!("total_time: {}\n", yaml_string(&humanise_duration(&data.total_time))));
    }
    if !data.author.is_empty() {
        out.push_str(&format!("adapted_from: {}\n", yaml_string(&data.author)));
    }
    out.push_str(&format!("source_url: {}\n", yaml_string(&data.source_url)));
    out.push_str("---\n\n");

    if !data.description.trim().is_empty() {
        out.push_str("> ");
        out.push_str(&data.description.replace('\n', " ").trim());
        out.push_str("\n\n");
    }

    if !data.image_url.is_empty() {
        out.push_str(&format!("![]({})\n\n", data.image_url));
    }

    out.push_str("## Ingredients\n\n");
    if data.ingredients.is_empty() {
        out.push_str("- \n\n");
    } else {
        for ing in &data.ingredients {
            out.push_str(&format!("- {}\n", ing.trim()));
        }
        out.push('\n');
    }

    out.push_str("## Instructions\n\n");
    if data.instructions.is_empty() {
        out.push_str("1. \n\n");
    } else {
        for (i, step) in data.instructions.iter().enumerate() {
            // 2.2.0 round 2 — auto-link bake/cook times into Yarrow
            // timer pills. Recipe instructions almost always say
            // "let rest 25 minutes" / "bake for 1 hour" — wrapping
            // those phrases as `[25 minutes](timer:25m)` markdown
            // links means the user can tap them in reading or
            // live-preview mode and start a countdown without
            // leaving the page.
            let with_timers = autolink_durations(&step.trim().replace('\n', "\n   "));
            out.push_str(&format!("{}. {}\n", i + 1, with_timers));
        }
        out.push('\n');
    }

    out.push_str("## Notes\n\n");
    out.push_str(&format!(
        "_Clipped from [the original]({}). Fork this note to record any tweaks you'd like to keep._\n",
        data.source_url
    ));

    out
}

// ──────────────── HTTP fetch (SSRF-guarded) ────────────────
//
// Reqwest's blocking client. We tried ureq first (with `gzip`/`brotli`
// features and a browser UA) but its chunked-transfer reader still
// failed with "Error while decoding chunks" on certain CDN-fronted
// sites — Pioneer Woman's plain-chunked HTML response was one of the
// repros. Reqwest's hyper stack handles every variant of chunked +
// compressed framing cleanly. Only this module uses reqwest; the
// rest of the codebase (sync, server connect, URL title fetch in
// `commands.rs`) keeps ureq.

const MAX_RECIPE_HTML_BYTES: usize = 4 * 1024 * 1024; // 4 MiB — recipe blogs ship big inline JS
const MAX_REDIRECTS: u32 = 5;
const FETCH_TIMEOUT: Duration = Duration::from_secs(15);

const BROWSER_UA: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

fn fetch_html_safe(url: &str) -> Result<String> {
    let parsed = url::Url::parse(url)
        .map_err(|_| YarrowError::Invalid("not a valid URL".into()))?;
    let scheme = parsed.scheme().to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return Err(YarrowError::Invalid(format!(
            "only http(s) URLs are supported, not {scheme}:"
        )));
    }
    if let Some(host) = parsed.host_str() {
        if is_private_or_loopback(host) {
            return Err(YarrowError::Invalid(
                "private / loopback addresses are blocked".into(),
            ));
        }
    }

    // We follow redirects manually so we can re-validate every hop
    // against the SSRF allowlist.
    let client = reqwest::blocking::Client::builder()
        .user_agent(BROWSER_UA)
        .redirect(reqwest::redirect::Policy::none())
        .timeout(FETCH_TIMEOUT)
        .http1_only()
        .gzip(true)
        .brotli(true)
        .build()
        .map_err(|e| YarrowError::Other(format!("HTTP client init failed: {e}")))?;

    let mut current = url.to_string();
    let mut hops: u32 = 0;

    let resp = loop {
        let r = client
            .get(&current)
            .header("Accept", "text/html,application/xhtml+xml,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .map_err(|e| YarrowError::Other(format!("fetch failed at {current}: {e}")))?;
        let status = r.status();

        if status.is_redirection() {
            if hops >= MAX_REDIRECTS {
                return Err(YarrowError::Other("too many redirects (5)".into()));
            }
            let location = r
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| YarrowError::Other("redirect with no Location".into()))?
                .to_string();
            let next_abs = url::Url::parse(&current)
                .and_then(|base| base.join(&location))
                .map_err(|_| YarrowError::Invalid("malformed redirect target".into()))?;
            let sch = next_abs.scheme().to_ascii_lowercase();
            if sch != "http" && sch != "https" {
                return Err(YarrowError::Invalid("redirect to non-http(s) blocked".into()));
            }
            if let Some(host) = next_abs.host_str() {
                if is_private_or_loopback(host) {
                    return Err(YarrowError::Invalid(
                        "redirect to private host blocked".into(),
                    ));
                }
            }
            current = next_abs.into();
            hops += 1;
            continue;
        }

        if !status.is_success() {
            // Snapshot the body to detect what kind of refusal we hit.
            // Cap at 400 chars so the toast stays readable.
            let preview = r
                .text()
                .unwrap_or_else(|_| String::from("<unreadable>"))
                .chars()
                .take(400)
                .collect::<String>();

            // Cloudflare's "Just a moment..." JS-challenge page is the
            // most common cause of these failures on recipe blogs.
            // Detect it specifically and give an actionable message —
            // generic "bot wall" copy makes the user feel the URL is
            // wrong when it isn't.
            let is_cloudflare_challenge =
                preview.contains("Just a moment...")
                || preview.contains("cf-mitigated")
                || preview.contains("__cf_chl_")
                || preview.to_lowercase().contains("cloudflare");

            if is_cloudflare_challenge {
                return Err(YarrowError::Invalid(format!(
                    "{} is behind Cloudflare bot protection. Yarrow can't fetch it directly — Cloudflare blocks any client that doesn't pass its JavaScript challenge. Workaround: open the URL in your browser, copy the recipe title + ingredients + instructions, and paste them into a Recipe Card kit (⌘N → Kits → Recipe card).",
                    current,
                )));
            }

            return Err(YarrowError::Other(format!(
                "server returned HTTP {} at {}. Preview: {}",
                status.as_u16(),
                current,
                preview,
            )));
        }
        break r;
    };

    // Capture Content-Encoding before consuming the response so a
    // decode failure surfaces the encoding in the user-facing error.
    let encoding = resp
        .headers()
        .get("content-encoding")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();

    let body = resp.text().map_err(|e| {
        YarrowError::Other(format!(
            "couldn't decode response body (content-encoding={encoding}): {e}"
        ))
    })?;

    if body.len() > MAX_RECIPE_HTML_BYTES {
        // Truncate at a char boundary so we can still parse leading
        // JSON-LD blocks. Recipe pages publish the schema.org Recipe
        // near the top of <head>, so the first 4 MiB is enough.
        let mut idx = MAX_RECIPE_HTML_BYTES;
        while !body.is_char_boundary(idx) && idx > 0 {
            idx -= 1;
        }
        return Ok(body[..idx].to_string());
    }
    Ok(body)
}

/// Mirrors `commands::is_private_or_loopback` — kept duplicated rather
/// than exported across modules to avoid widening the API surface of
/// `commands`. Update both when adding a new rejection class.
fn is_private_or_loopback(host: &str) -> bool {
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    if bare.eq_ignore_ascii_case("localhost") {
        return true;
    }
    if let Ok(ip) = bare.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(v4) => {
                v4.is_loopback()
                    || v4.is_private()
                    || v4.is_link_local()
                    || v4.is_unspecified()
                    || v4.is_broadcast()
                    || v4.octets() == [169, 254, 169, 254] // cloud metadata
            }
            IpAddr::V6(v6) => {
                v6.is_loopback() || v6.is_unspecified()
            }
        };
    }
    false
}

// ──────────────── JSON-LD extraction ────────────────

fn extract_jsonld_blocks(html: &str) -> Vec<String> {
    // Hand-rolled scanner; brings in no new dependencies and tolerates
    // typos / quirks in the wild that a strict HTML parser might choke
    // on. Looks for `<script type="application/ld+json">…</script>`
    // case-insensitively.
    let lower = html.to_ascii_lowercase();
    let needle = "<script";
    let close_open = '>';
    let close_tag = "</script>";

    let mut out = Vec::new();
    let mut cursor = 0;
    while cursor < lower.len() {
        let Some(rel_start) = lower[cursor..].find(needle) else { break };
        let tag_open_at = cursor + rel_start;
        // Find the closing `>` of the opening tag.
        let after_open = &lower[tag_open_at..];
        let Some(rel_gt) = after_open.find(close_open) else { break };
        let attrs = &lower[tag_open_at..tag_open_at + rel_gt];
        let body_start = tag_open_at + rel_gt + 1;
        // Match end tag.
        let after_body = &lower[body_start..];
        let body_end = match after_body.find(close_tag) {
            Some(rel_end) => body_start + rel_end,
            None => break,
        };
        cursor = body_end + close_tag.len();
        // Filter to ld+json scripts.
        if attrs.contains("application/ld+json") {
            // Take from the original case-preserving HTML.
            let chunk = &html[body_start..body_end];
            // Strip CDATA wrappers some sites add.
            let chunk = chunk.trim();
            let chunk = chunk
                .trim_start_matches("<![CDATA[")
                .trim_end_matches("]]>")
                .trim();
            if !chunk.is_empty() {
                out.push(chunk.to_string());
            }
        }
    }
    out
}

/// Walk a JSON value looking for an object whose `@type` resolves to
/// schema.org `Recipe`. Different sites express the type in different
/// shapes:
///
///   "@type": "Recipe"
///   "@type": "https://schema.org/Recipe"
///   "@type": "http://schema.org/Recipe"
///   "@type": "schema:Recipe"
///   "@type": ["Recipe", "Article"]      // multi-type
///
/// We accept any of those. Some sites also publish a `@graph` array
/// of mixed types so we drill in recursively.
fn find_recipe(root: &Value) -> Option<&Value> {
    fn is_recipe_type(s: &str) -> bool {
        // Strip URL / CURIE prefixes and check the trailing token.
        let tail = s
            .rsplit('/')
            .next()
            .unwrap_or(s)
            .rsplit(':')
            .next()
            .unwrap_or(s);
        tail.eq_ignore_ascii_case("Recipe")
    }
    fn matches_recipe(t: &Value) -> bool {
        match t {
            Value::String(s) => is_recipe_type(s),
            Value::Array(arr) => arr
                .iter()
                .any(|x| x.as_str().map(is_recipe_type).unwrap_or(false)),
            _ => false,
        }
    }
    fn walk<'a>(v: &'a Value) -> Option<&'a Value> {
        match v {
            Value::Object(map) => {
                if let Some(t) = map.get("@type") {
                    if matches_recipe(t) {
                        return Some(v);
                    }
                }
                for (_, child) in map {
                    if let Some(found) = walk(child) {
                        return Some(found);
                    }
                }
                None
            }
            Value::Array(arr) => arr.iter().find_map(walk),
            _ => None,
        }
    }
    walk(root)
}

// ──────────────── Microdata fallback ────────────────
//
// Some recipe sites (inspiredtaste.net is the canonical case)
// publish their recipe metadata as HTML5 microdata rather than
// schema.org JSON-LD. The shape:
//
//   <div itemscope itemtype="http://schema.org/Recipe">
//     <h1 itemprop="name">Spaghetti</h1>
//     <span itemprop="recipeYield">4 servings</span>
//     <li itemprop="recipeIngredient">1 lb pasta</li>
//     <li itemprop="recipeInstructions">Boil water…</li>
//     <meta itemprop="prepTime" content="PT15M">
//   </div>
//
// We parse this with regex rather than a proper DOM parser — it's a
// fallback and the structure is shallow enough that a regex pass
// handles 90% of real-world cases. For the rest, the user can fall
// back to a Recipe Card kit and copy/paste.

fn extract_microdata(html: &str, source_url: &str) -> Option<RecipeData> {
    use regex::Regex;
    use std::sync::OnceLock;

    // Locate the recipe scope. We need an element that has *both*
    // `itemscope` and `itemtype` containing "Recipe". The order of
    // attributes can vary, and there can be other attributes
    // between them — so we look for an opening tag that mentions
    // both ingredients.
    static SCOPE: OnceLock<Regex> = OnceLock::new();
    let scope_re = SCOPE.get_or_init(|| {
        Regex::new(
            r#"(?is)<(\w+)\b[^>]*\bitemscope\b[^>]*\bitemtype\s*=\s*["'][^"']*recipe["'][^>]*>"#,
        )
        .expect("recipe scope regex")
    });

    let m = scope_re.find(html)?;
    let scope_start = m.end();
    // Heuristic: take the next ~80 KB after the scope start. A real
    // recipe block is rarely larger than a few KB; this just bounds
    // the work and avoids scanning the entire page.
    let scope_end = (scope_start + 80_000).min(html.len());
    // Walk to a UTF-8 char boundary so the slice is valid.
    let mut bounded_end = scope_end;
    while bounded_end < html.len() && !html.is_char_boundary(bounded_end) {
        bounded_end += 1;
    }
    let scope_html = &html[scope_start..bounded_end];

    // Pull each itemprop= occurrence and its value. Two value
    // sources, ordered by preference:
    //   1. `content="..."` attribute (used for `<meta>` props)
    //   2. inner text up to the next `<` (for visible elements)
    //
    // We collect into a multimap by prop name; ingredients and
    // instructions are arrays.
    static PROP: OnceLock<Regex> = OnceLock::new();
    let prop_re = PROP.get_or_init(|| {
        // Match: <tag ... itemprop="name" ... content="..."?>...</tag>
        // Group 1: prop name. Group 2 (optional): content attribute.
        // Group 3: inner-text run up to the first `<`.
        Regex::new(
            r#"(?is)<(?:\w+)\b[^>]*\bitemprop\s*=\s*["']([\w]+)["'][^>]*?(?:\bcontent\s*=\s*["']([^"']*)["'])?[^>]*>([^<]{0,2000})"#,
        )
        .expect("itemprop regex")
    });

    let mut name = String::new();
    let mut description = String::new();
    let mut yield_ = String::new();
    let mut prep_time = String::new();
    let mut cook_time = String::new();
    let mut total_time = String::new();
    let mut author = String::new();
    let mut category = String::new();
    let mut image_url = String::new();
    let mut ingredients: Vec<String> = Vec::new();
    let mut instructions: Vec<String> = Vec::new();

    for caps in prop_re.captures_iter(scope_html) {
        let prop = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        // Prefer the content attribute (set on <meta> and time/datetime
        // tags); fall back to inner text. Strip surrounding whitespace
        // and HTML entities.
        let raw = caps
            .get(2)
            .map(|m| m.as_str().to_string())
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_default());
        let cleaned = decode_minimal_html(&raw);
        if cleaned.is_empty() {
            continue;
        }

        match prop {
            "name" if name.is_empty() => name = cleaned,
            "description" if description.is_empty() => description = cleaned,
            "recipeYield" | "yield" if yield_.is_empty() => yield_ = cleaned,
            "prepTime" if prep_time.is_empty() => prep_time = cleaned,
            "cookTime" | "performTime" if cook_time.is_empty() => cook_time = cleaned,
            "totalTime" if total_time.is_empty() => total_time = cleaned,
            "author" if author.is_empty() => author = cleaned,
            "recipeCategory" | "category" if category.is_empty() => category = cleaned,
            "image" if image_url.is_empty() => {
                // For <img itemprop="image" src="..."> we'd want src, not
                // inner text. Detect by re-checking the captured tag for
                // a src= attribute.
                if let Some(src) = extract_src_near(scope_html, caps.get(0).unwrap().start()) {
                    image_url = src;
                } else {
                    image_url = cleaned;
                }
            }
            "recipeIngredient" | "ingredient" | "ingredients" => {
                ingredients.push(cleaned);
            }
            "recipeInstructions" | "instructions" => {
                instructions.push(cleaned);
            }
            _ => {}
        }
    }

    if name.is_empty() && ingredients.is_empty() && instructions.is_empty() {
        return None;
    }

    Some(RecipeData {
        name,
        description,
        yield_,
        prep_time,
        cook_time,
        total_time,
        ingredients,
        instructions,
        category,
        author,
        image_url,
        source_url: source_url.to_string(),
    })
}

/// Look back from a captured tag start for a `src="…"` attribute.
/// Used so an `<img itemprop="image" src="…">` yields the URL, not
/// the alt-text inner.
fn extract_src_near(haystack: &str, tag_start: usize) -> Option<String> {
    // Find the actual `<` of the tag we matched. The capture started
    // at `<` already, so `tag_start` *is* the byte offset of `<`.
    // Slice the tag head and regex out src.
    let tag_end = haystack[tag_start..].find('>').map(|i| tag_start + i + 1)?;
    let tag = &haystack[tag_start..tag_end];
    let re = regex::Regex::new(r#"(?i)\bsrc\s*=\s*["']([^"']+)["']"#).ok()?;
    re.captures(tag)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

/// Decode the few HTML entities recipe pages most commonly use, plus
/// strip surrounding whitespace. Not a full HTML decoder — there's
/// no entity table here.
fn decode_minimal_html(s: &str) -> String {
    let mut out = s
        .trim()
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .replace("&mdash;", "—")
        .replace("&ndash;", "–");
    // Collapse runs of whitespace to a single space — multi-line
    // inner text in microdata is common but visually messy.
    let mut prev_space = false;
    out.retain(|c| {
        let is_space = c.is_whitespace();
        let keep = !(is_space && prev_space);
        prev_space = is_space;
        keep
    });
    out.trim().to_string()
}

// ──────────────── Recipe → RecipeData ────────────────

fn extract_recipe_data(v: &Value, source_url: &str) -> RecipeData {
    let mut d = RecipeData::default();
    d.source_url = source_url.to_string();
    d.name = string_field(v, "name");
    d.description = string_field(v, "description");
    d.yield_ = first_of(v, &["recipeYield", "yield"]);
    d.prep_time = string_field(v, "prepTime");
    d.cook_time = first_of(v, &["cookTime", "performTime"]);
    d.total_time = string_field(v, "totalTime");
    d.category = first_of(v, &["recipeCategory", "category"]);
    d.author = author_to_string(v.get("author"));
    d.image_url = image_to_url(v.get("image"));
    d.ingredients = string_array_field(v, "recipeIngredient");
    if d.ingredients.is_empty() {
        // Older schema variant.
        d.ingredients = string_array_field(v, "ingredients");
    }
    d.instructions = instructions_to_strings(v.get("recipeInstructions"));
    d
}

fn string_field(v: &Value, key: &str) -> String {
    match v.get(key) {
        Some(Value::String(s)) => s.trim().to_string(),
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|x| x.as_str())
            .collect::<Vec<_>>()
            .join(" · "),
        _ => String::new(),
    }
}

fn first_of(v: &Value, keys: &[&str]) -> String {
    for k in keys {
        let s = string_field(v, k);
        if !s.is_empty() {
            return s;
        }
    }
    String::new()
}

fn string_array_field(v: &Value, key: &str) -> Vec<String> {
    match v.get(key) {
        Some(Value::Array(arr)) => arr
            .iter()
            .filter_map(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        Some(Value::String(s)) => vec![s.trim().to_string()],
        _ => Vec::new(),
    }
}

fn author_to_string(v: Option<&Value>) -> String {
    let Some(v) = v else { return String::new() };
    match v {
        Value::String(s) => s.trim().to_string(),
        Value::Object(map) => map
            .get("name")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default()
            .to_string(),
        Value::Array(arr) => arr
            .iter()
            .filter_map(|x| match x {
                Value::String(s) => Some(s.trim().to_string()),
                Value::Object(m) => m.get("name").and_then(Value::as_str).map(str::to_string),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(", "),
        _ => String::new(),
    }
}

fn image_to_url(v: Option<&Value>) -> String {
    let Some(v) = v else { return String::new() };
    match v {
        Value::String(s) => s.trim().to_string(),
        Value::Object(map) => map
            .get("url")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default()
            .to_string(),
        Value::Array(arr) => arr
            .iter()
            .filter_map(|x| match x {
                Value::String(s) => Some(s.trim().to_string()),
                Value::Object(m) => m.get("url").and_then(Value::as_str).map(str::to_string),
                _ => None,
            })
            .next()
            .unwrap_or_default(),
        _ => String::new(),
    }
}

fn instructions_to_strings(v: Option<&Value>) -> Vec<String> {
    let Some(v) = v else { return Vec::new() };
    let mut out = Vec::new();
    fn walk(v: &Value, out: &mut Vec<String>) {
        match v {
            Value::String(s) => {
                let trimmed = s.trim();
                if !trimmed.is_empty() {
                    out.push(trimmed.to_string());
                }
            }
            Value::Object(map) => {
                // HowToStep / HowToSection / direct text-bearing object.
                if let Some(text) = map.get("text").and_then(Value::as_str) {
                    let t = text.trim();
                    if !t.is_empty() {
                        out.push(t.to_string());
                        return;
                    }
                }
                if let Some(name) = map.get("name").and_then(Value::as_str) {
                    let n = name.trim();
                    if !n.is_empty() {
                        out.push(format!("**{}**", n));
                    }
                }
                if let Some(items) = map.get("itemListElement") {
                    walk(items, out);
                }
            }
            Value::Array(arr) => {
                for item in arr {
                    walk(item, out);
                }
            }
            _ => {}
        }
    }
    walk(v, &mut out);
    out
}

/// Convert ISO-8601 durations like `PT1H30M` to "1 hr 30 min". Pass
/// other shapes through unchanged so already-friendly strings ("1 hour
/// 30 minutes") survive.
fn humanise_duration(raw: &str) -> String {
    let s = raw.trim();
    if !s.starts_with('P') && !s.starts_with('p') {
        return s.to_string();
    }
    let after_p = &s[1..];
    let (_, time_part) = match after_p.find(['T', 't']) {
        Some(i) => (&after_p[..i], &after_p[i + 1..]),
        None => (after_p, ""),
    };
    let mut hours: u32 = 0;
    let mut minutes: u32 = 0;
    let mut buf = String::new();
    for ch in time_part.chars() {
        if ch.is_ascii_digit() {
            buf.push(ch);
        } else {
            if let Ok(n) = buf.parse::<u32>() {
                match ch {
                    'H' | 'h' => hours = n,
                    'M' | 'm' => minutes = n,
                    _ => {}
                }
            }
            buf.clear();
        }
    }
    let mut out = Vec::new();
    if hours > 0 {
        out.push(format!("{} hr", hours));
    }
    if minutes > 0 {
        out.push(format!("{} min", minutes));
    }
    if out.is_empty() {
        return s.to_string();
    }
    out.join(" ")
}

fn yaml_string(s: &str) -> String {
    // Quote and escape — covers titles with apostrophes, colons, and
    // other YAML-significant characters without trying to be clever
    // about block scalars.
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{}\"", escaped)
}

/// Wrap clear duration phrases ("25 minutes", "1 hour", "1 hr 30 min",
/// "30 sec") in `[phrase](timer:Xm)` markdown links so the user can
/// tap them in reading / live-preview mode to start a countdown.
///
/// Matches conservatively — the phrase must end on a recognised unit
/// word (`hour(s)` / `hr(s)`, `minute(s)` / `min(s)`, `second(s)` /
/// `sec(s)`) or be a compound like `1 hour 30 minutes`. Bare numbers
/// ("preheat to 350") never match because there's no unit.
///
/// Implementation: a single regex with alternation, compound-first.
/// Rust's regex crate uses leftmost-first semantics — for an
/// alternation `(compound|simple)`, the compound branch is preferred
/// at every position, so `1 hour 30 minutes` is consumed as a single
/// match and the simple alternative never gets a chance to re-match
/// "1 hour" / "30 minutes" inside it. Cleaner than a two-pass
/// approach that has to detect already-wrapped substrings.
fn autolink_durations(s: &str) -> String {
    use regex::Regex;
    use std::sync::OnceLock;

    // Compound (groups 1, 2): "1 hour 30 minutes", "2 hr 15 min".
    // Simple   (groups 3, 4): "25 minutes", "1.5 hours", "30 sec".
    // (?i) case-insensitive; \b prevents partial matches like
    // "30 minute-by-minute".
    const PATTERN: &str = r"(?i)\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s+(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b|\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b";
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(PATTERN).expect("duration autolink regex"));

    re.replace_all(s, |caps: &regex::Captures| {
        // Compound branch matched?
        if let (Some(h_m), Some(m_m)) = (caps.get(1), caps.get(2)) {
            let h: f32 = h_m.as_str().parse().unwrap_or(0.0);
            let m: f32 = m_m.as_str().parse().unwrap_or(0.0);
            let total_min = (h * 60.0 + m).round() as u32;
            if total_min == 0 {
                return caps[0].to_string();
            }
            return format!("[{}](timer:{}m)", &caps[0], total_min);
        }
        // Simple branch.
        let n: f32 = caps[3].parse().unwrap_or(0.0);
        let unit = caps[4].to_lowercase();
        let total_sec: u32 = if unit.starts_with('h') {
            (n * 3600.0).round() as u32
        } else if unit.starts_with('m') {
            (n * 60.0).round() as u32
        } else {
            n.round() as u32
        };
        if total_sec == 0 {
            return caps[0].to_string();
        }
        let dur = if total_sec >= 3600 && total_sec % 3600 == 0 {
            format!("{}h", total_sec / 3600)
        } else if total_sec >= 60 {
            format!("{}m", total_sec.div_ceil(60))
        } else {
            format!("{}s", total_sec)
        };
        format!("[{}](timer:{})", &caps[0], dur)
    })
    .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_iso_durations() {
        assert_eq!(humanise_duration("PT1H30M"), "1 hr 30 min");
        assert_eq!(humanise_duration("PT15M"), "15 min");
        assert_eq!(humanise_duration("PT2H"), "2 hr");
        assert_eq!(humanise_duration("1 hour"), "1 hour");
    }

    #[test]
    fn finds_recipe_in_graph() {
        let json = serde_json::json!({
            "@graph": [
                { "@type": "WebPage", "name": "About us" },
                { "@type": "Recipe", "name": "Chocolate Cookies", "recipeIngredient": ["1 cup flour", "1 egg"] }
            ]
        });
        let r = find_recipe(&json).expect("recipe found");
        assert_eq!(r.get("name").and_then(Value::as_str), Some("Chocolate Cookies"));
    }

    #[test]
    fn finds_recipe_with_url_prefixed_type() {
        // Real-world variant: "@type": "https://schema.org/Recipe".
        // The previous matcher only handled the bare "Recipe" string.
        let json = serde_json::json!({
            "@type": "https://schema.org/Recipe",
            "name": "Spaghetti",
        });
        let r = find_recipe(&json).expect("recipe found");
        assert_eq!(r.get("name").and_then(Value::as_str), Some("Spaghetti"));
    }

    #[test]
    fn finds_recipe_with_curie_prefixed_type() {
        let json = serde_json::json!({
            "@type": "schema:Recipe",
            "name": "Stew",
        });
        let r = find_recipe(&json).expect("recipe found");
        assert_eq!(r.get("name").and_then(Value::as_str), Some("Stew"));
    }

    #[test]
    fn ignores_types_that_only_end_in_recipe_after_full_word_check() {
        // We strip URL/CURIE prefixes and check the trailing token —
        // "/Recipe" matches; "NotRecipe" wouldn't unless the trailing
        // segment is exactly "Recipe", which it isn't here.
        let json = serde_json::json!({
            "@type": "Article",
            "name": "How to write a recipe",
        });
        assert!(find_recipe(&json).is_none());
    }

    #[test]
    fn microdata_finds_basic_recipe() {
        let html = r##"
<html><body>
<div itemscope itemtype="http://schema.org/Recipe">
  <h1 itemprop="name">Test Pasta</h1>
  <span itemprop="recipeYield">4 servings</span>
  <ul>
    <li itemprop="recipeIngredient">1 lb pasta</li>
    <li itemprop="recipeIngredient">1 jar tomato sauce</li>
  </ul>
  <ol>
    <li itemprop="recipeInstructions">Boil water and add pasta.</li>
    <li itemprop="recipeInstructions">Drain and toss with sauce.</li>
  </ol>
</div>
</body></html>"##;
        let d = extract_microdata(html, "https://example.com/r").expect("microdata recipe");
        assert_eq!(d.name, "Test Pasta");
        assert_eq!(d.yield_, "4 servings");
        assert_eq!(d.ingredients.len(), 2);
        assert!(d.ingredients[0].contains("pasta"));
        assert_eq!(d.instructions.len(), 2);
        assert!(d.instructions[0].contains("Boil"));
    }

    #[test]
    fn microdata_returns_none_on_unrelated_page() {
        let html = "<html><body><p>just a regular page</p></body></html>";
        assert!(extract_microdata(html, "https://example.com/x").is_none());
    }

    #[test]
    fn extracts_jsonld_blocks() {
        let html = r#"<html><head>
<script type="application/ld+json">{"@type":"Recipe","name":"X"}</script>
<script>const x = 1;</script>
<script type="application/ld+json">{"@type":"Article","name":"Y"}</script>
</head></html>"#;
        let blocks = extract_jsonld_blocks(html);
        assert_eq!(blocks.len(), 2);
        assert!(blocks[0].contains("\"Recipe\""));
        assert!(blocks[1].contains("\"Article\""));
    }

    #[test]
    fn autolinks_simple_durations() {
        let out = autolink_durations("Let it rest 25 minutes, then knead.");
        assert!(out.contains("[25 minutes](timer:25m)"));
    }

    #[test]
    fn autolinks_hours() {
        let out = autolink_durations("Bake for 1 hour at 350.");
        assert!(out.contains("[1 hour](timer:1h)"));
    }

    #[test]
    fn autolinks_compound_durations() {
        let out = autolink_durations("Proof for 1 hour 30 minutes covered.");
        assert!(out.contains("[1 hour 30 minutes](timer:90m)"));
        // The compound match wins; no leftover separate "30 minutes"
        // link inside.
        assert!(!out.contains("](timer:30m)"));
    }

    #[test]
    fn autolinks_short_forms() {
        let out = autolink_durations("Stand 10 min then stir for 30 sec.");
        assert!(out.contains("[10 min](timer:10m)"));
        assert!(out.contains("[30 sec](timer:30s)"));
    }

    #[test]
    fn does_not_link_bare_numbers() {
        let out = autolink_durations("Preheat to 350 degrees and use 2 cups flour.");
        assert!(!out.contains("timer:"));
    }

    #[test]
    fn renders_clean_markdown() {
        let mut d = RecipeData::default();
        d.name = "Test".into();
        d.yield_ = "12 cookies".into();
        d.ingredients = vec!["1 cup flour".into(), "1 egg".into()];
        d.instructions = vec!["Mix.".into(), "Bake.".into()];
        d.source_url = "https://example.com/r".into();
        let md = render_markdown(&d);
        assert!(md.contains("yield: \"12 cookies\""));
        assert!(md.contains("- 1 cup flour"));
        assert!(md.contains("1. Mix."));
        assert!(md.contains("source_url: \"https://example.com/r\""));
    }
}
