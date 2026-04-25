pub mod app_config;
pub mod attachments;
pub mod bibtex_import;
pub mod commands;
pub mod crypto;
pub mod server_crypto;
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
pub mod sample_vault;
pub mod search;
pub mod search_index;
pub mod secrets;
pub mod server;
pub mod templates;
pub mod trash;
pub mod workspace;
pub mod ws_client;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                rescue_offscreen_window(&win);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cmd_init_workspace,
            commands::cmd_init_sample_workspace,
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
            commands::cmd_list_path_overrides,
            commands::cmd_clear_path_override,
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
            commands::cmd_create_workspace_dir,
            commands::cmd_count_wikilink_references,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
