use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HistoryEntry {
    pub filepath: String,
    pub stopped_at: f64,
    pub duration: f64,
    pub timestamp: u64,
}

fn get_history_path(app: &AppHandle) -> PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir());
    path.push("history.json");
    path
}

pub fn load_history_db(app: &AppHandle) -> HashMap<String, HistoryEntry> {
    let path = get_history_path(app);
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(db) = serde_json::from_str(&content) {
            return db;
        }
    }
    HashMap::new()
}

pub fn save_history_db(app: &AppHandle, db: &HashMap<String, HistoryEntry>) {
    let path = get_history_path(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(db) {
        let _ = fs::write(path, content);
    }
}

pub fn update_history(app: &AppHandle, filepath: &str, stopped_at: f64, duration: f64) {
    let mut db = load_history_db(app);
    
    // Ignore updates that are at the very beginning (less than 5 seconds) 
    // or very end (less than 5 seconds left) to prevent resuming from credits.
    if stopped_at < 5.0 || (duration > 0.0 && stopped_at > duration - 5.0) {
        // If it was watched to the end, maybe we keep it with a status 'watched', 
        // but for now let's just save it.
    }

    db.insert(
        filepath.to_string(),
        HistoryEntry {
            filepath: filepath.to_string(),
            stopped_at,
            duration,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        },
    );
    save_history_db(app, &db);
}

pub fn get_resume_position(app: &AppHandle, filepath: &str) -> Option<f64> {
    let db = load_history_db(app);
    if let Some(entry) = db.get(filepath) {
        // Don't resume if they were at the very end
        if entry.duration > 0.0 && entry.stopped_at > entry.duration - 10.0 {
            return None;
        }
        return Some(entry.stopped_at);
    }
    None
}

#[tauri::command]
pub fn get_recent_history(app: AppHandle) -> Result<String, String> {
    let db = load_history_db(&app);
    let mut entries: Vec<HistoryEntry> = db.into_values().collect();
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    serde_json::to_string(&entries).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(app: AppHandle) -> Result<(), String> {
    save_history_db(&app, &HashMap::new());
    Ok(())
}
