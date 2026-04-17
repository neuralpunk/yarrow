pub mod app_config;
pub mod attachments;
pub mod commands;
pub mod error;
pub mod export;
pub mod git;
pub mod graph;
pub mod notes;
pub mod search;
pub mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::cmd_create_note,
            commands::cmd_rename_note,
            commands::cmd_set_pinned,
            commands::cmd_delete_note,
            commands::cmd_add_link,
            commands::cmd_remove_link,
            commands::cmd_list_paths,
            commands::cmd_current_path,
            commands::cmd_create_path,
            commands::cmd_switch_path,
            commands::cmd_delete_path,
            commands::cmd_merge_path,
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
            commands::cmd_list_recent_workspaces,
            commands::cmd_forget_recent_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
