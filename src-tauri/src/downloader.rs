use tauri::{AppHandle, Emitter, Manager};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use reqwest::Client;
use futures_util::StreamExt;

#[derive(serde::Serialize, Clone)]
pub struct DownloadProgress {
    pub name: String,
    pub progress: f64,
    pub status: String,
}

pub fn get_bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let bin_dir = app_data_dir.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    }
    Ok(bin_dir)
}

#[tauri::command]
pub fn check_dependency(app: AppHandle, name: String) -> Result<bool, String> {
    let bin_dir = get_bin_dir(&app)?;
    #[cfg(target_os = "windows")]
    let file_path = bin_dir.join(format!("{}.exe", name));
    #[cfg(not(target_os = "windows"))]
    let file_path = bin_dir.join(&name);

    Ok(file_path.exists())
}

#[tauri::command]
pub async fn download_dependency(app: AppHandle, name: String, url: String) -> Result<(), String> {
    let bin_dir = get_bin_dir(&app)?;
    #[cfg(target_os = "windows")]
    let file_path = bin_dir.join(format!("{}.exe", name));
    #[cfg(not(target_os = "windows"))]
    let file_path = bin_dir.join(&name);

    let _ = app.emit("download-progress", DownloadProgress {
        name: name.clone(),
        progress: 0.0,
        status: "Starting download...".to_string(),
    });

    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    let total_size = res.content_length().unwrap_or(0) as f64;
    let mut downloaded: f64 = 0.0;
    
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as f64;
        
        let progress = if total_size > 0.0 { (downloaded / total_size) * 100.0 } else { 0.0 };
        
        // Optimize by not emitting on every single tiny chunk
        if downloaded as u64 % (1024 * 512) == 0 || downloaded == total_size {
            let _ = app.emit("download-progress", DownloadProgress {
                name: name.clone(),
                progress,
                status: "Downloading".to_string(),
            });
        }
    }

    // Ensure it's executable on linux/mac
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&file_path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        let _ = fs::set_permissions(&file_path, perms);
    }

    let _ = app.emit("download-progress", DownloadProgress {
        name: name.clone(),
        progress: 100.0,
        status: "Completed".to_string(),
    });

    Ok(())
}
