use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;


#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Episode {
    pub filepath: String,
    pub filename: String,
    pub show_name: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
}

#[tauri::command]
pub fn scan_folder_for_episodes(folder_path: String) -> Result<String, String> {
    let mut episodes = Vec::new();
    
    // Pattern to match S01E02, S1E2, 1x02, etc.
    let re = Regex::new(r"(?i)(?:s|season\s*)(?P<season>\d{1,2})[\s_.-]*(?:e|x|episode\s*)(?P<episode>\d{1,3})").unwrap();

    let paths = fs::read_dir(&folder_path).map_err(|e| e.to_string())?;

    for path in paths {
        if let Ok(entry) = path {
            let path_buf = entry.path();
            if path_buf.is_file() {
                let filename = entry.file_name().into_string().unwrap_or_default();
                let filepath = path_buf.to_string_lossy().to_string();
                
                // Simple extension filter
                let lower_name = filename.to_lowercase();
                let media_exts = [".mkv", ".mp4", ".avi", ".webm", ".mov", ".m4v", ".flv", ".wmv", ".ts", ".mp3", ".flac", ".wav", ".ogg", ".aac", ".m4a"];
                if !media_exts.iter().any(|ext| lower_name.ends_with(ext)) {
                    continue;
                }

                let mut season = None;
                let mut ep_num = None;
                let mut show_name = None;

                if let Some(caps) = re.captures(&filename) {
                    if let Some(s) = caps.name("season") {
                        season = s.as_str().parse::<u32>().ok();
                    }
                    if let Some(e) = caps.name("episode") {
                        ep_num = e.as_str().parse::<u32>().ok();
                    }
                    
                    // Basic show name extraction (everything before the S01E02 part)
                    if let Some(mat) = caps.get(0) {
                        let before = &filename[0..mat.start()];
                        let cleaned = before.replace(".", " ").replace("_", " ").trim().to_string();
                        if !cleaned.is_empty() {
                            show_name = Some(cleaned);
                        }
                    }
                }

                episodes.push(Episode {
                    filepath,
                    filename,
                    show_name,
                    season,
                    episode: ep_num,
                });
            }
        }
    }

    // Sort episodes by season then episode
    episodes.sort_by(|a, b| {
        a.season.unwrap_or(0).cmp(&b.season.unwrap_or(0))
            .then(a.episode.unwrap_or(0).cmp(&b.episode.unwrap_or(0)))
    });

    serde_json::to_string(&episodes).map_err(|e| e.to_string())
}
