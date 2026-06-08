#![allow(dependency_on_unit_never_type_fallback)]
use tauri::{Emitter, Manager};
use tauri_plugin_single_instance::init as single_instance_init;

mod player;
use player::{
    init_player, load_media, seek_media, set_loop, set_speed, set_subtitle_delay,
    set_subtitle_speed, set_subtitle_track, set_volume, toggle_play, toggle_pause, PlayerState,
    set_chapter, next_chapter, previous_chapter,
    set_audio_track, set_audio_delay, set_audio_channels, set_audio_filter,
    set_video_color, set_panscan, toggle_deinterlace, take_screenshot, set_property_string,
    playlist_load_multiple, playlist_append_multiple, playlist_next, playlist_prev, playlist_clear, playlist_play_index, playlist_remove,
    set_upscale_mode, set_upscale_sharpness,
    load_subtitle,
};

mod history;
use history::{clear_history, get_recent_history};

mod playlist;
use playlist::scan_folder_for_episodes;

mod plugins;
#[tauri::command]
fn get_custom_themes(app: tauri::AppHandle) -> Result<Vec<plugins::Theme>, String> {
    plugins::get_themes(&app)
}

mod ffmpeg;
use ffmpeg::start_transcode;

mod downloader;
use downloader::{check_dependency, download_dependency};

#[tauri::command]
fn register_default_app() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::env;
        use winreg::enums::*;
        use winreg::RegKey;

        let exe_path = env::current_exe().map_err(|e| e.to_string())?;
        let exe_path_str = exe_path.to_str().unwrap_or_default();

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        let extensions = [
            ".mp4", ".mkv", ".webm", ".avi", ".mov", ".mp3", ".wav", ".flac", ".aac", ".ogg",
            ".wma", ".jpg", ".jpeg", ".png", ".webp", ".gif",
        ];
        let app_prog_id = "NiroMedia.App";

        // Register the ProgID
        let (prog_id_key, _) = hkcu
            .create_subkey(format!("Software\\Classes\\{}", app_prog_id))
            .map_err(|e| e.to_string())?;
        prog_id_key
            .set_value("", &"Niro Media")
            .map_err(|e| e.to_string())?;

        let (icon_key, _) = prog_id_key
            .create_subkey("DefaultIcon")
            .map_err(|e| e.to_string())?;
        icon_key
            .set_value("", &format!("{},0", exe_path_str))
            .map_err(|e| e.to_string())?;

        let (command_key, _) = prog_id_key
            .create_subkey("shell\\open\\command")
            .map_err(|e| e.to_string())?;
        command_key
            .set_value("", &format!("\"{}\" \"%1\"", exe_path_str))
            .map_err(|e| e.to_string())?;

        // Associate extensions with the ProgID
        for ext in extensions.iter() {
            let (ext_key, _) = hkcu
                .create_subkey(format!("Software\\Classes\\{}", ext))
                .map_err(|e| e.to_string())?;
            ext_key
                .set_value("", &app_prog_id)
                .map_err(|e| e.to_string())?;

            let (open_with, _) = hkcu
                .create_subkey(format!("Software\\Classes\\{}\\OpenWithProgids", ext))
                .map_err(|e| e.to_string())?;
            open_with
                .set_value(app_prog_id, &"")
                .map_err(|e| e.to_string())?;
        }

        Ok("✓ Niro Media set as default media player".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("Default app registration is only supported on Windows".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(single_instance_init(|app, argv, _cwd| {
            // When user opens a file while app is already running, emit to the existing window
            if argv.len() > 1 {
                let file_path = argv.last().unwrap().clone();
                if !file_path.starts_with('-') {
                    let _ = app.emit("open-file-cli", file_path);
                }
            }
            // Focus the existing window
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .manage(PlayerState {
            cmd_tx: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            register_default_app,
            init_player,
            load_media,
            toggle_play,
            toggle_pause,
            set_volume,
            seek_media,
            set_speed,
            set_loop,
            set_subtitle_track,
            set_subtitle_delay,
            set_subtitle_speed,
            get_recent_history,
            clear_history,
            scan_folder_for_episodes,
            set_chapter,
            next_chapter,
            previous_chapter,
            set_audio_track,
            set_audio_delay,
            set_audio_channels,
            set_audio_filter,
            set_video_color,
            set_panscan,
            toggle_deinterlace,
            take_screenshot,
            player::set_tone_mapping,
            player::set_property_string,
            playlist_load_multiple,
            playlist_append_multiple,
            playlist_next,
            playlist_prev,
            playlist_clear,
            playlist_play_index,
            playlist_remove,
            set_upscale_mode,
            set_upscale_sharpness,
            load_subtitle,
            get_custom_themes,
            start_transcode,
            check_dependency,
            download_dependency
        ])
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

            let _ = app.global_shortcut().on_shortcut("MediaPlayPause", |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = player::toggle_pause(app.clone());
                }
            });

            let _ = app.global_shortcut().on_shortcut("MediaNextTrack", |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = player::playlist_next(app.clone());
                }
            });

            let _ = app.global_shortcut().on_shortcut("MediaPrevTrack", |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = player::playlist_prev(app.clone());
                }
            });

            // Handle CLI argument on first launch
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = args.last().unwrap().clone();
                if !file_path.starts_with('-') && file_path != args[0] {
                    let app_handle = app.handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(600));
                        let _ = app_handle.emit("open-file-cli", file_path);
                    });
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
