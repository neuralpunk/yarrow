//! Optional SQLite + FTS5 search cache.
//!
//! This module is a **derived cache** — never the source of truth. The
//! canonical data lives in flat markdown files; `.yarrow/index.db` is just
//! a faster search box. Every function here is written so that failing
//! silently (file corrupted, SQLite couldn't open, whatever) degrades to
//! "search via the substring scanner instead" rather than breaking the
//! app. Wiping the db is always safe — it'll be rebuilt lazily.
//!
//! The index is off-limits for any feature that treats search output as
//! authoritative. If tomorrow we added "move all matches to trash", that
//! would need the substring path, not this one.
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};

use crate::notes;
use crate::search::SearchHit;

/// Relative path of the index DB inside a workspace. Gitignored.
pub const INDEX_DB_REL: &str = ".yarrow/index.db";

/// Schema version tag stored in the `user_version` pragma. Bump this when
/// you change the FTS table shape so old caches get blown away + rebuilt
/// on next open rather than silently mis-indexing.
const SCHEMA_VERSION: i32 = 1;

pub fn db_path(root: &Path) -> PathBuf {
    root.join(INDEX_DB_REL)
}

/// Open (or create) the search-cache db at `<root>/.yarrow/index.db`.
/// Applies the schema migration on first open and on schema-version drift.
pub fn open(root: &Path) -> rusqlite::Result<Connection> {
    let path = db_path(root);
    if let Some(parent) = path.parent() {
        // `.yarrow/` should already exist in any initialized workspace,
        // but be defensive — rebuild-from-empty-dir should also work.
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(&path)?;
    // WAL gives us concurrent reads while one writer updates — matters
    // once Yarrow has multiple windows open against the same vault.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let current: i32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap_or(0);
    if current == SCHEMA_VERSION {
        return Ok(());
    }
    // Any version mismatch → wipe + rebuild. Cheaper than writing a
    // proper migration for a cache that can always be rederived.
    conn.execute_batch(
        r#"
        DROP TABLE IF EXISTS notes_fts;
        CREATE VIRTUAL TABLE notes_fts USING fts5(
            slug UNINDEXED,
            title,
            body,
            tags,
            tokenize = 'unicode61 remove_diacritics 2'
        );
        "#,
    )?;
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(())
}

/// Insert or replace the row for one note.
pub fn upsert(
    conn: &Connection,
    slug: &str,
    title: &str,
    body: &str,
    tags: &[String],
) -> rusqlite::Result<()> {
    // FTS5 has no native primary key, so we emulate upsert with a delete
    // followed by an insert inside a transaction. The `slug UNINDEXED`
    // column lookup is a full table scan — fine at the single-note
    // scale we're called at; we'd need a side-table of slug→rowid to
    // optimize batch rebuilds, but `rebuild` below handles that case by
    // truncating instead.
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM notes_fts WHERE slug = ?1", params![slug])?;
    tx.execute(
        "INSERT INTO notes_fts (slug, title, body, tags) VALUES (?1, ?2, ?3, ?4)",
        params![slug, title, body, tags.join(" ")],
    )?;
    tx.commit()
}

/// Drop a single note from the cache — called when a note is trashed or
/// renamed (rename = delete old slug + upsert new).
pub fn delete(conn: &Connection, slug: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM notes_fts WHERE slug = ?1", params![slug])?;
    Ok(())
}

/// How many rows are in the cache. Used by the rebuild path so we can
/// skip the work if the cache is already populated.
pub fn row_count(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COUNT(*) FROM notes_fts", [], |r| r.get(0))
        .optional()
        .map(|c| c.unwrap_or(0))
}

/// Turn a free-text user query into an FTS5 MATCH expression. We keep
/// only alphanumeric runs (plus underscore and apostrophe) per term and
/// append `*` for prefix matching — so "fogg*" finds "foggy" and
/// "FitzGerald" tokenises into two prefix searches, not one invalid
/// quoted phrase. Returns `None` when nothing useful survives (caller
/// falls back to substring search in that case).
pub fn sanitize_query(q: &str) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    for raw in q.split_whitespace() {
        let cleaned: String = raw
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '\'')
            .collect();
        if cleaned.len() >= 2 {
            parts.push(format!("{}*", cleaned));
        } else if cleaned.len() == 1 {
            // Single-char prefix matches are huge and expensive; ignore.
            continue;
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

/// Execute a query. Returns `Ok(vec![])` for both "no results" and
/// "empty query" so the caller can't tell the two apart — by design, an
/// empty query is a valid "I have no matches yet" state.
pub fn query(
    conn: &Connection,
    user_query: &str,
    limit: usize,
) -> rusqlite::Result<Vec<SearchHit>> {
    let match_expr = match sanitize_query(user_query) {
        Some(m) => m,
        None => return Ok(Vec::new()),
    };
    let mut stmt = conn.prepare_cached(
        r#"
        SELECT
            slug,
            title,
            snippet(notes_fts, 2, '«', '»', '…', 16) AS snippet,
            bm25(notes_fts) AS score
        FROM notes_fts
        WHERE notes_fts MATCH ?1
        ORDER BY score
        LIMIT ?2
        "#,
    )?;
    let rows = stmt.query_map(params![match_expr, limit as i64], |row| {
        let slug: String = row.get(0)?;
        let title: String = row.get(1)?;
        let snippet: String = row.get(2)?;
        let bm25: f64 = row.get(3)?;
        // BM25 returns negative scores where lower = better. Invert and
        // scale to a positive int so the frontend's sort-by-score
        // expectations (matching the substring path) stay intact.
        let score = (-bm25 * 10.0).round() as i32;
        Ok(SearchHit { slug, title, snippet, score })
    })?;
    let mut out = Vec::with_capacity(limit);
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Wipe the cache file from disk. Called by the "clear index cache"
/// Settings button and by the rebuild path before re-indexing. Removing
/// the WAL sidecars too keeps us from re-opening a half-committed WAL.
pub fn clear_file(root: &Path) -> std::io::Result<()> {
    let base = db_path(root);
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let p = if suffix.is_empty() {
            base.clone()
        } else {
            base.with_extension(format!("db{}", suffix))
        };
        match std::fs::remove_file(&p) {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
    }
    Ok(())
}

/// Re-scan every note on disk and rebuild the cache from scratch. Best-
/// effort — a single unreadable note is skipped, not a fatal error.
/// Returns the number of rows indexed.
pub fn rebuild(root: &Path) -> anyhow::Result<usize> {
    // Start from an empty file so we don't carry over ghost rows for
    // notes that were deleted while indexing was disabled.
    let _ = clear_file(root);
    let conn = open(root)?;
    let summaries = notes::list(root)?;
    let tx = conn.unchecked_transaction()?;
    let mut count = 0usize;
    for s in &summaries {
        let note = match notes::read(root, &s.slug) {
            Ok(n) => n,
            Err(_) => continue,
        };
        // Encrypted bodies are opaque — indexing the ciphertext would
        // pollute FTS with noise and enable nothing useful. Match the
        // substring path's behaviour: title + tags only.
        let searchable_body = if note.frontmatter.encrypted {
            String::new()
        } else {
            note.body.clone()
        };
        tx.execute(
            "INSERT INTO notes_fts (slug, title, body, tags) VALUES (?1, ?2, ?3, ?4)",
            params![
                note.slug,
                note.frontmatter.title,
                searchable_body,
                note.frontmatter.tags.join(" "),
            ],
        )?;
        count += 1;
    }
    tx.commit()?;
    Ok(count)
}

/// Called from save hooks. Opens the DB, upserts one note, and swallows
/// any failure (with a stderr log) — the cache is allowed to fall
/// behind. Caller must have already checked that indexing is enabled
/// for this workspace.
pub fn upsert_note_best_effort(root: &Path, slug: &str, title: &str, body: &str, tags: &[String]) {
    let conn = match open(root) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("search_index: open failed, skipping upsert for {slug}: {e}");
            return;
        }
    };
    if let Err(e) = upsert(&conn, slug, title, body, tags) {
        eprintln!("search_index: upsert failed for {slug}: {e}");
    }
}

/// Twin of `upsert_note_best_effort` for delete/rename-old flows.
pub fn delete_note_best_effort(root: &Path, slug: &str) {
    let conn = match open(root) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("search_index: open failed, skipping delete for {slug}: {e}");
            return;
        }
    };
    if let Err(e) = delete(&conn, slug) {
        eprintln!("search_index: delete failed for {slug}: {e}");
    }
}
