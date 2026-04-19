pub mod app_config;
pub mod attachments;
pub mod commands;
pub mod crypto;
pub mod error;
pub mod export;
pub mod find_replace;
pub mod git;
pub mod graph;
pub mod notes;
pub mod obsidian_import;
pub mod path_collections;
pub mod path_meta;
pub mod search;
pub mod templates;
pub mod trash;
pub mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::cmd_init_workspace,
            commands::cmd_open_workspace,
            commands::cmd_active_workspace,
            commands::cmd_close_workspace,
            commands::cmd_read_config,
            commands::cmd_set_remote,
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
            commands::cmd_save_note,
            commands::cmd_save_note_full,
            commands::cmd_create_note,
            commands::cmd_rename_note,
            commands::cmd_set_pinned,
            commands::cmd_set_tags,
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
            commands::cmd_rename_path_collection,
            commands::cmd_set_path_collection_condition,
            commands::cmd_set_path_collection_main_note,
            commands::cmd_set_path_collection_parent,
            commands::cmd_add_note_to_path_collection,
            commands::cmd_remove_note_from_path_collection,
            commands::cmd_set_path_collection_root,
            commands::cmd_get_graph,
            commands::cmd_orphans,
            commands::cmd_note_history,
            commands::cmd_note_at_checkpoint,
            commands::cmd_restore_note,
            commands::cmd_paragraph_provenance,
            commands::cmd_sync,
            commands::cmd_read_scratchpad,
            commands::cmd_save_scratchpad,
            commands::cmd_append_scratchpad,
            commands::cmd_promote_scratchpad,
            commands::cmd_search,
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
            commands::cmd_find_replace_preview,
            commands::cmd_find_replace_apply,
            commands::cmd_read_dictionary,
            commands::cmd_write_dictionary,
            commands::cmd_open_new_window,
            commands::cmd_compare_paths,
            commands::cmd_import_obsidian_vault,
            commands::cmd_default_workspaces_root,
            commands::cmd_create_workspace_dir,
            commands::cmd_count_wikilink_references,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
