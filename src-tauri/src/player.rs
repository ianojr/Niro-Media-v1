use std::sync::Mutex;
use tauri::{AppHandle, Manager, Emitter};
use libmpv2::{Mpv, events::Event};
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use std::sync::mpsc::{channel, Sender};

#[derive(serde::Serialize, Clone)]
pub struct Chapter {
    pub index: i64,
    pub title: String,
    pub time: f64,
}

#[derive(serde::Serialize, Clone)]
pub struct Telemetry {
    pub time: f64,
    pub duration: f64,
    pub paused: bool,
    pub hwdec: String,
    pub vformat: String,
    pub vid: String,
    pub sig_peak: f64,
}

#[derive(serde::Serialize, Clone)]
pub struct Track {
    pub id: i64,
    pub kind: String,
    pub title: String,
    pub lang: String,
}

pub struct PlayerState {
    pub cmd_tx: Mutex<Option<Sender<Vec<String>>>>,
}

#[tauri::command]
pub fn init_player(app: AppHandle) -> Result<(), String> {
    let state = app.state::<PlayerState>();
    if state.cmd_tx.lock().unwrap().is_some() {
        return Ok(());
    }

    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let window_handle = window.window_handle().map_err(|e| e.to_string())?;
    
    let wid: i64 = match window_handle.as_raw() {
        #[cfg(target_os = "windows")]
        RawWindowHandle::Win32(handle) => handle.hwnd.get() as i64,
        _ => return Err("Unsupported OS for native MPV integration".to_string()),
    };

    let (tx, rx) = channel::<Vec<String>>();
    
    let state = app.state::<PlayerState>();
    *state.cmd_tx.lock().unwrap() = Some(tx);

    let app_clone = app.clone();

    std::thread::spawn(move || {
        let mpv = Mpv::new().expect("Failed to init MPV");
        mpv.set_property("wid", wid).unwrap();
        
        // gpu-next is safer and faster for modern windows composition
        let _ = mpv.set_property("vo", "gpu");
        let _ = mpv.set_property("force-window", "yes");
        
        // Use auto-copy or d3d11va-copy to prevent breaking transparent Tauri webviews
        #[cfg(target_os = "windows")]
        let _ = mpv.set_property("hwdec", "d3d11va-copy");
        #[cfg(not(target_os = "windows"))]
        let _ = mpv.set_property("hwdec", "auto-copy");

        mpv.set_property("keep-open", "yes").unwrap();
        
        // High Performance Safely
        let _ = mpv.set_property("vd-lavc-threads", 8);
        let _ = mpv.set_property("cache", "yes");
        // Safe cache sizes (in MiB instead of bytes to avoid parse errors)
        let _ = mpv.set_property("demuxer-max-bytes", 1024 * 1024 * 250); // 250MB
        let _ = mpv.set_property("framedrop", "vo"); 
        
        // Network Streaming
        mpv.set_property("ytdl", "yes").unwrap_or(());
        
        if let Ok(app_data_dir) = app_clone.path().app_data_dir() {
            let bin_dir = app_data_dir.join("bin");
            #[cfg(target_os = "windows")]
            let ytdl_path = bin_dir.join("yt-dlp.exe");
            #[cfg(not(target_os = "windows"))]
            let ytdl_path = bin_dir.join("yt-dlp");
            
            if ytdl_path.exists() {
                if let Some(path_str) = ytdl_path.to_str() {
                    let _ = mpv.set_property("ytdl-path", path_str);
                }
            }
        }

        // Subtitle optimization
        mpv.set_property("blend-subtitles", "video").unwrap_or(());
        mpv.set_property("subs-fallback", "yes").unwrap_or(());

        // Load Lua plugins from AppData
        if let Ok(app_data_dir) = app_clone.path().app_data_dir() {
            let plugins_dir = app_data_dir.join("plugins");
            if !plugins_dir.exists() {
                let _ = std::fs::create_dir_all(&plugins_dir);
            } else if let Ok(entries) = std::fs::read_dir(&plugins_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                        if ext == "lua" || ext == "js" {
                            if let Some(path_str) = path.to_str() {
                                let _ = mpv.command("load-script", &[path_str]);
                            }
                        }
                    }
                }
            }
        }

        // In some libmpv versions, log messages are enabled via msg-level or request_log_messages is omitted in the safe wrapper.
        let _ = mpv.set_property("msg-level", "all=error");

        let _ = mpv.observe_property("time-pos", libmpv2::Format::Double, 0);
        let _ = mpv.observe_property("duration", libmpv2::Format::Double, 0);
        let _ = mpv.observe_property("pause", libmpv2::Format::Flag, 0);
        let _ = mpv.observe_property("hwdec-current", libmpv2::Format::String, 0);
        let _ = mpv.observe_property("video-format", libmpv2::Format::String, 0);
        let _ = mpv.observe_property("video-params/sig-peak", libmpv2::Format::Double, 0);

        let mut corrupt_count = 0;
        let mut current_path = String::new();
        let mut current_time = 0.0;
        let mut current_duration = 0.0;
        let mut is_paused = false;
        let mut current_hwdec = String::from("Software");
        let mut current_vformat = String::from("Unknown");
        let mut current_vid = String::from("no");
        let mut current_sig_peak = 0.0;

        loop {
            // Process incoming commands
            while let Ok(cmd) = rx.try_recv() {
                let args: Vec<&str> = cmd.iter().map(|s| s.as_str()).collect();
                if args[0] == "set_property" {
                    // Use the "set" command so MPV automatically parses strings to numbers
                    let _ = mpv.command("set", &[args[1], args[2]]);
                } else if args[0] == "set_property_string" {
                    let _ = mpv.command("set", &[args[1], args[2]]);
                } else {
                    let _ = mpv.command(args[0], &args[1..]);
                }
            }

            // Wait for events
            if let Some(Ok(event)) = mpv.wait_event(0.01) {
                match event {
                    Event::PropertyChange { name, change, .. } => {
                        println!("PROPERTY CHANGE: {} -> {:?}", name, change);
                        let mut updated = false;
                        if name == "time-pos" {
                            if let libmpv2::events::PropertyData::Double(val) = change {
                                current_time = val;
                                updated = true;
                            }
                        } else if name == "duration" {
                            if let libmpv2::events::PropertyData::Double(val) = change {
                                current_duration = val;
                                updated = true;
                            }
                        } else if name == "pause" {
                            if let libmpv2::events::PropertyData::Flag(val) = change {
                                is_paused = val;
                                updated = true;
                            }
                        } else if name == "hwdec-current" {
                            if let libmpv2::events::PropertyData::Str(val) = change {
                                current_hwdec = val.to_string();
                                updated = true;
                            }
                        } else if name == "video-format" {
                            if let libmpv2::events::PropertyData::Str(val) = change {
                                current_vformat = val.to_string();
                                updated = true;
                            }
                        } else if name == "vid" {
                            if let libmpv2::events::PropertyData::Str(val) = change {
                                current_vid = val.to_string();
                                updated = true;
                            }
                        } else if name == "video-params/sig-peak" {
                            if let libmpv2::events::PropertyData::Double(val) = change {
                                current_sig_peak = val;
                                updated = true;
                            }
                        }
                        
                        if updated {
                            let _ = app_clone.emit("time-update", Telemetry {
                                time: current_time,
                                duration: current_duration,
                                paused: is_paused,
                                hwdec: current_hwdec.clone(),
                                vformat: current_vformat.clone(),
                                vid: current_vid.clone(),
                                sig_peak: current_sig_peak,
                            });
                        }
                    },
                    Event::StartFile => {
                        current_vformat = "Loading".to_string();
                        current_vid = "no".to_string();
                    }
                    Event::FileLoaded => {
                        if current_vformat == "Loading" {
                            current_vformat = "Unknown".to_string();
                        }
                        if let Ok(path) = mpv.get_property::<String>("path") {
                            current_path = path.clone();
                            // Try to resume
                            if let Some(pos) = crate::history::get_resume_position(&app_clone, &path) {
                                let _ = mpv.set_property("time-pos", pos);
                            }
                        }

                        // Extract Chapters
                        if let Ok(chapters_count) = mpv.get_property::<i64>("chapters") {
                            let mut chapters = Vec::new();
                            for i in 0..chapters_count {
                                let title = mpv.get_property::<String>(&format!("chapter-list/{}/title", i))
                                    .unwrap_or_else(|_| format!("Chapter {}", i + 1));
                                let time = mpv.get_property::<f64>(&format!("chapter-list/{}/time", i))
                                    .unwrap_or(0.0);
                                chapters.push(Chapter { index: i, title, time });
                            }
                            let _ = app_clone.emit("chapters-updated", chapters);
                        }

                        // Extract Tracks
                        if let Ok(track_count) = mpv.get_property::<i64>("track-list/count") {
                            let mut tracks = Vec::new();
                            for i in 0..track_count {
                                let kind = mpv.get_property::<String>(&format!("track-list/{}/type", i)).unwrap_or_default();
                                let title = mpv.get_property::<String>(&format!("track-list/{}/title", i)).unwrap_or_default();
                                let lang = mpv.get_property::<String>(&format!("track-list/{}/lang", i)).unwrap_or_default();
                                let id = mpv.get_property::<i64>(&format!("track-list/{}/id", i)).unwrap_or(-1);
                                tracks.push(Track { id, kind, title, lang });
                            }
                            let _ = app_clone.emit("tracks-updated", tracks);
                        }
                    },
                    Event::EndFile(_res) => {
                        if !current_path.is_empty() {
                            crate::history::update_history(&app_clone, &current_path, current_time, current_duration);
                        }
                    },
                    Event::LogMessage { text, .. } => {
                        let text_lower = text.to_lowercase();
                        if text_lower.contains("invalid nal") || text_lower.contains("corrupt") || text_lower.contains("truncated") || text_lower.contains("error while decoding") {
                            corrupt_count += 1;
                            if corrupt_count > 3 {
                                // Pause playback
                                let _ = mpv.set_property("pause", true);
                                // Emit Tauri event
                                let _ = app_clone.emit("file-corrupt-warning", ());
                                corrupt_count = 0; // reset
                            }
                        }
                    },
                    _ => {}
                }
            }
        }
    });

    Ok(())
}

fn send_cmd(app: &AppHandle, cmd: Vec<String>) -> Result<(), String> {
    let state = app.state::<PlayerState>();
    if let Some(tx) = state.cmd_tx.lock().unwrap().as_ref() {
        tx.send(cmd).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_media(app: AppHandle, path: String) -> Result<(), String> {
    send_cmd(&app, vec!["loadfile".to_string(), path])
}

#[tauri::command]
pub fn toggle_play(app: AppHandle, pause: bool) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "pause".to_string(), if pause { "yes".to_string() } else { "no".to_string() }])
}

#[tauri::command]
pub fn toggle_pause(app: AppHandle) -> Result<(), String> {
    send_cmd(&app, vec!["cycle".to_string(), "pause".to_string()])
}

#[tauri::command]
pub fn set_volume(app: AppHandle, volume: f64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "volume".to_string(), (volume * 100.0).to_string()])
}

#[tauri::command]
pub fn seek_media(app: AppHandle, position: f64) -> Result<(), String> {
    send_cmd(&app, vec!["seek".to_string(), position.to_string(), "absolute".to_string()])
}

#[tauri::command]
pub fn set_speed(app: AppHandle, speed: f64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "speed".to_string(), speed.to_string()])
}

#[tauri::command]
pub fn set_loop(app: AppHandle, loop_play: bool) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "loop-file".to_string(), if loop_play { "inf".to_string() } else { "no".to_string() }])
}

#[tauri::command]
pub fn set_subtitle_track(app: AppHandle, track_id: String) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "sid".to_string(), track_id])
}

#[tauri::command]
pub fn set_subtitle_delay(app: AppHandle, delay: f64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "sub-delay".to_string(), delay.to_string()])
}

#[tauri::command]
pub fn set_subtitle_speed(app: AppHandle, speed: f64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "sub-speed".to_string(), speed.to_string()])
}

#[tauri::command]
pub fn set_chapter(app: AppHandle, index: i64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "chapter".to_string(), index.to_string()])
}

#[tauri::command]
pub fn next_chapter(app: AppHandle) -> Result<(), String> {
    send_cmd(&app, vec!["add".to_string(), "chapter".to_string(), "1".to_string()])
}

#[tauri::command]
pub fn previous_chapter(app: AppHandle) -> Result<(), String> {
    send_cmd(&app, vec!["add".to_string(), "chapter".to_string(), "-1".to_string()])
}

#[tauri::command]
pub fn set_audio_track(app: AppHandle, track_id: String) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "aid".to_string(), track_id])
}

#[tauri::command]
pub fn set_audio_delay(app: AppHandle, delay: f64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "audio-delay".to_string(), delay.to_string()])
}

#[tauri::command]
pub fn set_audio_channels(app: AppHandle, layout: String) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "audio-channels".to_string(), layout])
}

#[tauri::command]
pub fn set_audio_filter(app: AppHandle, filter_string: String) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "af".to_string(), filter_string])
}

#[tauri::command]
pub fn set_video_color(app: AppHandle, property: String, value: i64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), property, value.to_string()])
}

#[tauri::command]
pub fn set_panscan(app: AppHandle, value: f64) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "panscan".to_string(), value.to_string()])
}

#[tauri::command]
pub fn toggle_deinterlace(app: AppHandle, enable: bool) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "deinterlace".to_string(), if enable { "yes".to_string() } else { "no".to_string() }])
}

#[tauri::command]
pub fn take_screenshot(app: AppHandle, path: String, include_subtitles: bool) -> Result<(), String> {
    let mode = if include_subtitles { "window" } else { "video" };
    send_cmd(&app, vec!["screenshot-to-file".to_string(), path, mode.to_string()])
}

#[tauri::command]
pub fn set_tone_mapping(app: AppHandle, mapping: String) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), "tone-mapping".to_string(), mapping])
}

#[tauri::command]
pub fn set_property_string(app: AppHandle, name: String, value: String) -> Result<(), String> {
    send_cmd(&app, vec!["set_property".to_string(), name, value])
}
