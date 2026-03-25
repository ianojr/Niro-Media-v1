use tauri::{Emitter, Manager};
use tauri_plugin_single_instance::init as single_instance_init;

#[tauri::command]
fn register_default_app() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        use std::env;

        let exe_path = env::current_exe().map_err(|e| e.to_string())?;
        let exe_path_str = exe_path.to_str().unwrap_or_default();

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        let extensions = [".mp4", ".mkv", ".webm", ".avi", ".mov", ".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".jpg", ".jpeg", ".png", ".webp", ".gif"];
        let app_prog_id = "NiroMedia.App";

        // Register the ProgID
        let (prog_id_key, _) = hkcu.create_subkey(format!("Software\\Classes\\{}", app_prog_id)).map_err(|e| e.to_string())?;
        prog_id_key.set_value("", &"Niro Media").map_err(|e| e.to_string())?;

        let (icon_key, _) = prog_id_key.create_subkey("DefaultIcon").map_err(|e| e.to_string())?;
        icon_key.set_value("", &format!("{},0", exe_path_str)).map_err(|e| e.to_string())?;

        let (command_key, _) = prog_id_key.create_subkey("shell\\open\\command").map_err(|e| e.to_string())?;
        command_key.set_value("", &format!("\"{}\" \"%1\"", exe_path_str)).map_err(|e| e.to_string())?;

        // Associate extensions with the ProgID
        for ext in extensions.iter() {
            let (ext_key, _) = hkcu.create_subkey(format!("Software\\Classes\\{}", ext)).map_err(|e| e.to_string())?;
            ext_key.set_value("", &app_prog_id).map_err(|e| e.to_string())?;

            let (open_with, _) = hkcu.create_subkey(format!("Software\\Classes\\{}\\OpenWithProgids", ext)).map_err(|e| e.to_string())?;
            open_with.set_value(app_prog_id, &"").map_err(|e| e.to_string())?;
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
        .invoke_handler(tauri::generate_handler![register_default_app])
        .setup(|app| {
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
