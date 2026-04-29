pub mod app_config;
pub mod attachments;
pub mod bibliography;
pub mod bibtex_import;
pub mod commands;
pub mod crypto;
pub mod server_crypto;
pub mod drafts;
pub mod error;
pub mod export;
pub mod find_replace;
pub mod foreign_import;
pub mod fuzzy;
pub mod git;
pub mod graph;
pub mod notes;
pub mod obsidian_import;
pub mod path_collections;
pub mod path_content;
pub mod path_meta;
pub mod recipe_clip;
pub mod sample_vault;
pub mod search;
pub mod search_index;
pub mod secrets;
pub mod shopping_list;
pub mod server;
pub mod templates;
pub mod trash;
pub mod welcome;
pub mod workspace;
pub mod ws_client;

// 3.0 visual polish — macOS sidebar vibrancy.
//
// macOS's NSVisualEffectView produces the translucent material that
// sidebar surfaces in Finder, Mail, and Notes use; it picks up colour
// from whatever's behind the window (wallpaper, other apps) and is the
// single most distinctive macOS-native touch available.
//
// We attach the `Sidebar` material to the main window's contentView at
// startup. The frontend signals this via a `data-mac-vibrancy="true"`
// attribute on <html> (set inside the setup callback below via
// `eval(...)`); CSS uses that attribute to switch the sidebar's
// background to transparent so the vibrancy shows through.
//
// Best-effort — on failure (older macOS, sandbox quirk, future Tauri
// regression like the 2.1.x titleBarStyle saga) we log and carry on
// with the existing flat sidebar background. Never fatal.
//
// `#[cfg(target_os = "macos")]` because the crate target gate in
// Cargo.toml already restricts the dependency to macOS — the
// reference would fail to compile on Linux/Windows otherwise.
#[cfg(target_os = "macos")]
fn apply_macos_vibrancy(win: &tauri::WebviewWindow) {
    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
    match apply_vibrancy(
        win,
        NSVisualEffectMaterial::Sidebar,
        Some(NSVisualEffectState::Active),
        // Corner radius of the vibrancy effect view itself (not the
        // window). The doc suggests 8.0; we leave it at None so the
        // material follows the window shape exactly — Tauri's window
        // already has its own radius.
        None,
    ) {
        Ok(()) => {
            // Surface state to the frontend so CSS can toggle the
            // sidebar to a transparent background. Using `eval` (not
            // `emit`) because it has to land on <html> before paint.
            let _ = win.eval(
                "document.documentElement.dataset.macVibrancy = 'true';",
            );
        }
        Err(e) => {
            eprintln!("[yarrow] vibrancy unavailable, falling back to flat sidebar: {e}");
        }
    }
}

/// Theme-aware vibrancy material switch (per theme system spec §9.1).
///
/// Light-family themes (Vellum, Linen, Ashrose) use `Sidebar` — the
/// material designed for translucent sidebars in light apps; it picks
/// up wallpaper warmth without darkening the chrome. Dark-family
/// themes (Workshop, Graphite, Dracula) use `HudWindow` — a deeper,
/// less-translucent material that reads as solid-with-depth on a
/// dark canvas, where `Sidebar` would let too much wallpaper bleed
/// through and muddy the colour identity.
///
/// Best-effort: failures (older macOS, sandbox quirk, unknown theme
/// string) just log and leave the previous material in place. Called
/// from the frontend after a theme change resolves.
#[tauri::command]
#[allow(unused_variables)]
fn cmd_apply_theme_vibrancy(window: tauri::WebviewWindow, theme: String) {
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
        let material = match theme.as_str() {
            "vellum" | "linen" | "ashrose" | "light" => {
                NSVisualEffectMaterial::Sidebar
            }
            "workshop" | "graphite" | "dracula" | "dark" => {
                NSVisualEffectMaterial::HudWindow
            }
            _ => NSVisualEffectMaterial::Sidebar,
        };
        if let Err(e) = apply_vibrancy(
            &window,
            material,
            Some(NSVisualEffectState::Active),
            None,
        ) {
            eprintln!("[yarrow] theme vibrancy switch failed: {e}");
        }
    }
}

/// System color-scheme probe (theme system spec §9.3).
///
/// On modern desktop environments WebKit2GTK exposes
/// `prefers-color-scheme` correctly via the GTK / Qt theme bridge,
/// so the frontend's matchMedia call already does the right thing.
/// This command is a Rust-side fallback for older DEs where the
/// WebView reports "no-preference" — we read the same XDG settings
/// the WebView would consult and return the resolved family.
///
/// Return values: `"light"`, `"dark"`, or `"unknown"`. The frontend
/// only uses "unknown" as a tiebreaker; any concrete answer wins.
///
/// Linux: query the freedesktop `org.freedesktop.appearance.color-scheme`
/// portal-equivalent via gsettings (GNOME 42+ / KDE Plasma 6 honour
/// this key). Falls back to `GTK_THEME` env naming heuristics if
/// gsettings isn't available.
///
/// macOS / Windows: rely on the WebView's matchMedia — the platform
/// integrations there are mature and the Rust path would just
/// duplicate logic that already works.
#[tauri::command]
fn cmd_detect_color_scheme() -> String {
    #[cfg(target_os = "linux")]
    {
        // 1. gsettings (GNOME 42+ honours this; KDE Plasma 6 mirrors it).
        if let Ok(out) = std::process::Command::new("gsettings")
            .args([
                "get",
                "org.gnome.desktop.interface",
                "color-scheme",
            ])
            .output()
        {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).to_ascii_lowercase();
                if s.contains("dark") {
                    return "dark".into();
                }
                if s.contains("light") || s.contains("default") {
                    return "light".into();
                }
            }
        }

        // 2. KDE-specific colorscheme hint via env.
        if let Ok(scheme) = std::env::var("KDE_SESSION_VERSION") {
            // KDE_SESSION_VERSION=6 + KDE Plasma should already drive
            // gsettings above. If we land here KDE failed to expose
            // it; fall through to GTK_THEME below.
            let _ = scheme;
        }

        // 3. GTK_THEME naming hint — `…-dark` suffix is conventional.
        if let Ok(t) = std::env::var("GTK_THEME") {
            let lower = t.to_ascii_lowercase();
            if lower.ends_with(":dark") || lower.contains("-dark") {
                return "dark".into();
            }
        }
    }
    "unknown".into()
}

/// Validate the saved window rect against the current monitor and
/// reset it on mismatch. This breaks the bad-state-inherits-itself
/// cycle that bit macOS Tahoe in 2.1.0 → 2.1.2: the borderless
/// `decorations: false` setup in 2.1.0 / 2.1.1 confused Tahoe's
/// window manager about safe-area insets and the window-state
/// plugin happily saved a position that was partially above the
/// menu bar / partially below the dock. Every subsequent launch —
/// including 2.1.2's `titleBarStyle: "Overlay"` config — restored
/// the bogus rect, so traffic lights ended up off-screen at the top
/// and the status bar ended up off-screen at the bottom and the
/// user only saw the middle slice.
///
/// Logic: if the restored window is even partly off the connected
/// monitor — origin negative beyond a small drag-tolerance, or
/// extending past the monitor's bottom/right edge — we recentre
/// with a default 1400 × 900 frame. Self-healing on the next clean
/// launch; subsequent launches save a valid rect and skip this path.
fn rescue_offscreen_window(win: &tauri::WebviewWindow) {
    let pos = match win.outer_position() {
        Ok(p) => p,
        Err(_) => return,
    };
    let size = match win.outer_size() {
        Ok(s) => s,
        Err(_) => return,
    };
    let monitor = match win.current_monitor() {
        Ok(Some(m)) => m,
        _ => match win.primary_monitor() {
            Ok(Some(m)) => m,
            _ => return,
        },
    };
    let mp = monitor.position();
    let ms = monitor.size();
    // Generous 60-px slack on each edge so a deliberately-edge-
    // docked window isn't forced back to centre. We only intervene
    // when a meaningful chunk of the window is genuinely off the
    // visible area.
    const SLACK: i32 = 60;
    let left = pos.x;
    let top = pos.y;
    let right = pos.x + size.width as i32;
    let bottom = pos.y + size.height as i32;
    let mon_left = mp.x;
    let mon_top = mp.y;
    let mon_right = mp.x + ms.width as i32;
    let mon_bottom = mp.y + ms.height as i32;
    let off_top = top < mon_top - SLACK;
    let off_bottom = bottom > mon_bottom + SLACK;
    let off_left = left < mon_left - SLACK;
    let off_right = right > mon_right + SLACK;
    let oversize = size.width > ms.width || size.height > ms.height;
    if !(off_top || off_bottom || off_left || off_right || oversize) {
        return;
    }
    eprintln!(
        "[yarrow] rescuing off-screen window — pos=({},{}) size=({},{}) monitor=({},{} {}x{})",
        pos.x, pos.y, size.width, size.height, mp.x, mp.y, ms.width, ms.height,
    );
    // Default 1400 × 900, clamped to fit even on a 13" laptop.
    let target_w = (1400u32).min(ms.width.saturating_sub(40));
    let target_h = (900u32).min(ms.height.saturating_sub(40));
    let _ = win.set_size(tauri::PhysicalSize::new(target_w, target_h));
    let _ = win.center();
}

// 2.2.0 — Native macOS menu bar.
//
// Mac apps without a system menu read as "wrapped web app." We mount a
// minimal but proper menu bar — Yarrow / File / Edit / View / Window —
// that mirrors the existing keyboard shortcuts and routes user-driven
// items (New Note, Settings…, Toggle Focus, etc.) through the existing
// `yarrow:center-action` plumbing on the frontend. Predefined items
// (Cut/Copy/Paste/Undo/etc.) hand off to native NSResponder so they
// work with system focus regardless of CodeMirror's state.
//
// macOS-only. Linux and Windows keep their existing custom-titlebar
// layout — adding a native menu bar there would compete with our
// custom chrome (and on Linux GNOME, menu bars are increasingly
// non-standard anyway).
#[cfg(target_os = "macos")]
fn build_native_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{
        AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem,
        SubmenuBuilder,
    };

    let about_meta = AboutMetadataBuilder::new()
        .name(Some("Yarrow"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        // 2.2.1 — fuller About panel: macOS shows the standard
        // metadata fields (comments, copyright, website link, OSS
        // license, credits line) when they're populated, so the
        // About sheet matches the depth users expect from a native
        // app instead of just showing a name + version.
        .comments(Some("Git-backed note-taking for non-linear thinking."))
        .copyright(Some("© 2026 Yarrow contributors. Released under the MIT license."))
        .website(Some("https://github.com/neuralpunk/yarrow"))
        .website_label(Some("Source on GitHub"))
        .license(Some("MIT"))
        .credits(Some("Built with Tauri 2, Svelte 5, CodeMirror 6, and D3."))
        .build();

    let app_submenu = SubmenuBuilder::new(app, "Yarrow")
        .item(&PredefinedMenuItem::about(app, Some("About Yarrow"), Some(about_meta))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    // ── File ──
    let new_note = MenuItemBuilder::with_id("yarrow:menu:newNote", "New Note")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let new_path = MenuItemBuilder::with_id("yarrow:menu:newPath", "New Direction")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?;
    let today = MenuItemBuilder::with_id("yarrow:menu:todayJournal", "Today's Journal")
        .accelerator("CmdOrCtrl+T")
        .build(app)?;
    let settings = MenuItemBuilder::with_id("yarrow:menu:settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&new_note)
        .item(&new_path)
        .item(&today)
        .separator()
        .item(&settings)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    // ── Edit ── (predefined items hand off to native NSResponder so
    // they work transparently with whatever has focus — CodeMirror,
    // Settings inputs, etc. — without our event plumbing.)
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // ── View ── (custom items routed through `yarrow:center-action`)
    let palette = MenuItemBuilder::with_id("yarrow:menu:palette", "Command Palette")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let focus = MenuItemBuilder::with_id("yarrow:menu:focus", "Toggle Focus Mode")
        .accelerator("CmdOrCtrl+\\")
        .build(app)?;
    let live_preview = MenuItemBuilder::with_id("yarrow:menu:livePreview", "Toggle Live Preview")
        .build(app)?;
    let outline = MenuItemBuilder::with_id("yarrow:menu:outline", "Outline This Note")
        .build(app)?;
    let constellation = MenuItemBuilder::with_id("yarrow:menu:constellation", "Connection Graph")
        .build(app)?;
    let scratchpad = MenuItemBuilder::with_id("yarrow:menu:scratchpad", "Toggle Scratchpad")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&palette)
        .item(&focus)
        .separator()
        .item(&live_preview)
        .item(&outline)
        .item(&constellation)
        .separator()
        .item(&scratchpad)
        .build()?;

    // ── Window ──
    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&window_submenu)
        .build()
}

/// Apply the macOS-native menu and route menu events to the frontend.
/// On non-macOS this is a no-op so Linux/Windows keep their existing
/// chrome (custom titlebar, no menu strip).
fn install_native_menu(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Emitter;
        return builder
            .menu(|app| build_native_menu(app))
            .on_menu_event(|app, event| {
                let id_str: &str = event.id().as_ref();
                if let Some(action) = id_str.strip_prefix("yarrow:menu:") {
                    let _ = app.emit("yarrow:menu-action", action.to_string());
                }
            });
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = builder;
        builder
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(commands::AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // 2.2.0 — Rust-backed system clipboard read/write so paste sees
        // text copied from other apps. The webview's `navigator.clipboard`
        // is sandboxed and only reads its own writes.
        .plugin(tauri_plugin_clipboard_manager::init())
        // 2.1.4: removed `tauri_plugin_window_state`. The plugin has
        // multiple unfixed macOS bugs (issues #14822, #3289, #1097 in
        // tauri-apps): random resizes to half the min width, broken
        // size restore, hangs with `decorations: false`, and a habit
        // of restoring positions saved on a now-disconnected monitor
        // unchanged. Across 2.1.0 → 2.1.3 it kept poisoning the saved
        // window state so each "fix" inherited the previous version's
        // bad coords. We give up on cross-launch position memory for
        // now in exchange for reliable startup behaviour; every launch
        // opens at the config default (1400 × 900) centered on the
        // primary monitor. We can re-introduce position restoration
        // later via custom logic that doesn't have these macOS bugs.
        .setup(|app| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                rescue_offscreen_window(&win);
                #[cfg(target_os = "macos")]
                apply_macos_vibrancy(&win);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_apply_theme_vibrancy,
            cmd_detect_color_scheme,
            commands::cmd_init_workspace,
            commands::cmd_init_sample_workspace,
            commands::cmd_clone_workspace,
            commands::cmd_open_workspace,
            commands::cmd_active_workspace,
            commands::cmd_close_workspace,
            commands::cmd_read_config,
            commands::cmd_set_remote,
            commands::cmd_server_connect_password,
            commands::cmd_server_connect_token,
            commands::cmd_server_test_connection,
            commands::cmd_server_disconnect,
            commands::cmd_list_notes,
            commands::cmd_attach_bytes,
            commands::cmd_attach_from_path,
            commands::cmd_read_attachment,
            commands::cmd_export_static,
            commands::cmd_export_path_markdown,
            commands::cmd_notes_on_path,
            commands::cmd_open_daily,
            commands::cmd_list_daily,
            commands::cmd_list_daily_dates,
            commands::cmd_read_daily_template,
            commands::cmd_write_daily_template,
            commands::cmd_read_note,
            commands::cmd_read_note_on_path,
            commands::cmd_save_note,
            commands::cmd_save_note_on_path,
            commands::cmd_save_note_full,
            commands::cmd_quicksave_note,
            commands::cmd_list_path_overrides,
            commands::cmd_clear_path_override,
            commands::cmd_borrow_note,
            commands::cmd_borrow_text,
            commands::cmd_create_note,
            commands::cmd_rename_note,
            commands::cmd_set_pinned,
            commands::cmd_set_note_folder,
            commands::cmd_set_tags,
            commands::cmd_suggest_tags,
            commands::cmd_set_annotations,
            commands::cmd_pin_checkpoint,
            commands::cmd_list_pinned_checkpoints,
            commands::cmd_unpin_checkpoint,
            commands::cmd_delete_note,
            commands::cmd_note_absolute_path,
            commands::cmd_add_link,
            commands::cmd_remove_link,
            commands::cmd_list_paths,
            commands::cmd_current_path,
            commands::cmd_create_path,
            commands::cmd_switch_path,
            commands::cmd_delete_path,
            commands::cmd_merge_path,
            commands::cmd_list_path_meta,
            commands::cmd_set_path_condition,
            commands::cmd_set_note_on_path,
            commands::cmd_list_path_collections,
            commands::cmd_create_path_collection,
            commands::cmd_delete_path_collection,
            commands::cmd_promote_path_to_main,
            commands::cmd_rename_path_collection,
            commands::cmd_set_path_collection_condition,
            commands::cmd_set_path_collection_color,
            commands::cmd_set_path_archived,
            commands::cmd_paths_diverging_for_note,
            commands::cmd_path_divergence_summary,
            commands::cmd_set_path_collection_auto_tag,
            commands::cmd_suggest_path_clusters,
            commands::cmd_set_path_collection_main_note,
            commands::cmd_set_path_collection_parent,
            commands::cmd_add_note_to_path_collection,
            commands::cmd_remove_note_from_path_collection,
            commands::cmd_set_path_collection_root,
            commands::cmd_get_graph,
            commands::cmd_orphans,
            commands::cmd_note_history,
            commands::cmd_writing_activity,
            commands::cmd_note_at_checkpoint,
            commands::cmd_restore_note,
            commands::cmd_paragraph_provenance,
            commands::cmd_sync,
            commands::cmd_discard_unsynced_changes,
            commands::cmd_force_align_with_server,
            commands::cmd_list_large_blobs,
            commands::cmd_reclaim_space,
            commands::cmd_read_scratchpad,
            commands::cmd_save_scratchpad,
            commands::cmd_append_scratchpad,
            commands::cmd_promote_scratchpad,
            commands::cmd_write_text_file,
            commands::cmd_search,
            commands::cmd_fuzzy_rank,
            commands::cmd_clear_search_index,
            commands::cmd_rebuild_search_index,
            commands::cmd_clear_all_cache,
            commands::cmd_branch_topology,
            commands::cmd_merge_state,
            commands::cmd_list_conflicts,
            commands::cmd_get_conflict,
            commands::cmd_resolve_conflict,
            commands::cmd_finalize_merge,
            commands::cmd_abort_merge,
            commands::cmd_update_preferences,
            commands::cmd_update_workspace_name,
            commands::cmd_set_workspace_mode,
            commands::cmd_set_main_note,
            commands::cmd_list_recent_workspaces,
            commands::cmd_forget_recent_workspace,
            commands::cmd_rename_recent_workspace,
            commands::cmd_welcome_stats,
            commands::cmd_list_templates,
            commands::cmd_read_template,
            commands::cmd_write_template,
            commands::cmd_delete_template,
            commands::cmd_create_from_template,
            commands::cmd_encryption_status,
            commands::cmd_enable_encryption,
            commands::cmd_unlock_encryption,
            commands::cmd_recover_encryption,
            commands::cmd_lock_encryption,
            commands::cmd_activity_ping,
            commands::cmd_change_encryption_password,
            commands::cmd_regenerate_recovery_phrase,
            commands::cmd_disable_encryption,
            commands::cmd_encrypt_note,
            commands::cmd_decrypt_note,
            commands::cmd_prune_history_older_than,
            commands::cmd_prune_empty_checkpoints,
            commands::cmd_fetch_url_title,
            commands::cmd_list_trash,
            commands::cmd_restore_from_trash,
            commands::cmd_purge_from_trash,
            commands::cmd_empty_trash,
            commands::cmd_render_note_html,
            commands::cmd_render_note_body_html,
            commands::cmd_render_markdown_html,
            commands::cmd_find_replace_preview,
            commands::cmd_find_replace_apply,
            commands::cmd_read_dictionary,
            commands::cmd_write_dictionary,
            commands::cmd_open_new_window,
            commands::cmd_compare_paths,
            commands::cmd_import_obsidian_vault,
            commands::cmd_import_bear_vault,
            commands::cmd_import_logseq_vault,
            commands::cmd_import_notion_vault,
            commands::cmd_import_bibtex,
            commands::cmd_default_workspaces_root,
            commands::cmd_desktop_env,
            commands::cmd_create_workspace_dir,
            commands::cmd_count_wikilink_references,
            commands::cmd_render_bibliography,
            commands::cmd_insert_bibliography,
            commands::cmd_render_notes_html,
            commands::cmd_render_path_html,
            commands::cmd_clip_recipe,
            commands::cmd_add_recipe_to_shopping_list,
            commands::cmd_shopping_list_slug,
            commands::cmd_draft_list_for_note,
            commands::cmd_draft_create,
            commands::cmd_draft_read,
            commands::cmd_draft_save,
            commands::cmd_draft_rename,
            commands::cmd_draft_discard,
            commands::cmd_draft_promote,
        ]);
    // Native menu (macOS only — Linux/Windows pass through unchanged).
    install_native_menu(builder)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
