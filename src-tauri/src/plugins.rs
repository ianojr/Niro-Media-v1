use std::fs;
use tauri::{AppHandle, Manager};

#[derive(serde::Serialize)]
pub struct Theme {
    pub name: String,
    pub css: String,
}

pub fn get_themes(app: &AppHandle) -> Result<Vec<Theme>, String> {
    let mut themes = Vec::new();
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let themes_dir = app_data_dir.join("themes");
        if !themes_dir.exists() {
            let _ = fs::create_dir_all(&themes_dir);
            return Ok(themes);
        }
        
        if let Ok(entries) = fs::read_dir(themes_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("css") {
                    if let Ok(css) = fs::read_to_string(&path) {
                        let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
                        themes.push(Theme { name, css });
                    }
                }
            }
        }
    }
    Ok(themes)
}
