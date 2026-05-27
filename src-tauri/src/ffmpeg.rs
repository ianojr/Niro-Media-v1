use tauri::{AppHandle, Emitter, Manager};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;

#[derive(serde::Serialize, Clone)]
pub struct TranscodeProgress {
    pub output_file: String,
    pub time_str: String,
    pub status: String,
}

#[tauri::command]
pub fn start_transcode(app: AppHandle, input: String, output: String) -> Result<(), String> {
    let app_clone = app.clone();
    let out_clone = output.clone();
    
    // Build path to AppData/bin/ffmpeg.exe
    let mut ffmpeg_path = std::path::PathBuf::from("ffmpeg");
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let bin_dir = app_data_dir.join("bin");
        #[cfg(target_os = "windows")]
        let exe_path = bin_dir.join("ffmpeg.exe");
        #[cfg(not(target_os = "windows"))]
        let exe_path = bin_dir.join("ffmpeg");
        
        if exe_path.exists() {
            ffmpeg_path = exe_path;
        }
    }
    
    thread::spawn(move || {
        let mut child = match Command::new(&ffmpeg_path)
            .arg("-y") // Overwrite output
            .arg("-i").arg(&input)
            .arg("-c:v").arg("libx264")
            .arg("-preset").arg("fast")
            .arg("-c:a").arg("aac")
            .arg(&out_clone)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn() {
                Ok(c) => c,
                Err(e) => {
                    let _ = app_clone.emit("transcode-progress", TranscodeProgress {
                        output_file: out_clone.clone(),
                        time_str: "00:00:00".to_string(),
                        status: format!("Error spawning ffmpeg: {}", e),
                    });
                    return;
                }
            };

        let stderr = child.stderr.take().expect("Failed to open stderr");
        let reader = BufReader::new(stderr);

        // FFmpeg writes progress updates using \r instead of \n
        for bytes in reader.split(b'\r') {
            if let Ok(line_str) = String::from_utf8(bytes.unwrap_or_default()) {
                if let Some(time_idx) = line_str.find("time=") {
                    let time_substr = &line_str[time_idx + 5..];
                    if let Some(space_idx) = time_substr.find(' ') {
                        let time_val = &time_substr[..space_idx];
                        let _ = app_clone.emit("transcode-progress", TranscodeProgress {
                            output_file: out_clone.clone(),
                            time_str: time_val.to_string(),
                            status: "Processing".to_string(),
                        });
                    }
                }
            }
        }

        let status = child.wait().unwrap();
        let final_status = if status.success() {
            "Completed".to_string()
        } else {
            "Failed".to_string()
        };

        let _ = app_clone.emit("transcode-progress", TranscodeProgress {
            output_file: out_clone.clone(),
            time_str: "Done".to_string(),
            status: final_status,
        });
    });

    Ok(())
}
