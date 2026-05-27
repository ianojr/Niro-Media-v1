import { useState, useRef, useEffect } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { type } from "@tauri-apps/plugin-os";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, X, Minus, Square, MonitorDown, Image as ImageIcon, Sun } from "lucide-react";
import "./App.css";

const appWindow = getCurrentWindow();

const THEMES: Record<string, string[]> = {
  luxury: ['#FE81D4', '#FAACBF', '#FBC3C1', '#FFEABB'],
  green: ['#adff00', '#74d600', '#00d27f', '#00ff83'],
  pink: ['#ff00a9', '#fb9f9f', '#ff0065', '#ffbfd3'],
  cappuccino: ['#be9b7b', '#fff4e6', '#854442', '#3c2f2f'],
  retro: ['#fb2e01', '#6fcb9f', '#ffe28a', '#fffeb3'],
  teal: ['#007777', '#006666', '#005555', '#004444'],
  gray: ['#999999', '#777777', '#555555', '#bbbbbb'],
  coffee: ['#ece0d1', '#dbc1ac', '#967259', '#634832'],
  kawaii: ['#ffdef2', '#f2e2ff', '#e2eeff', '#ddfffc']
};
const THEME_NAMES = Object.keys(THEMES);

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovering, setIsHovering] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaxState, setIsMaxState] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showBrightnessSlider, setShowBrightnessSlider] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00:00");
  const [duration, setDuration] = useState("0:00:00");
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [theme, setTheme] = useState('luxury');
  const [autoCycle, setAutoCycle] = useState(false);
  const [cycleInterval, setCycleInterval] = useState(15);
  const [regStatus, setRegStatus] = useState("");
  const [currentFileName, setCurrentFileName] = useState("");
  const [recentFiles, setRecentFiles] = useState<{name: string, path: string}[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hoverTimeoutTimer = useRef<number | null>(null);

  const visualizerContainerRef = useRef<HTMLDivElement>(null);
  const bubbleIdCounter = useRef(0);
  const isAudioFile = mediaUrl ? !!mediaUrl.match(/\.(mp3|wav|flac|aac|ogg|wma)$/i) : false;

  const loadMedia = async (filePath: string) => {
    const isImg = filePath.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)$/i) != null;
    setIsImage(isImg);
    const assetUrl = convertFileSrc(filePath);
    setMediaUrl(assetUrl);
    
    const fileName = filePath.split(/[/\\]/).pop() || "Unknown Media";
    setCurrentFileName(fileName);
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== filePath);
      return [{name: fileName, path: filePath}, ...filtered].slice(0, 10);
    });

    try {
      await invoke("init_player");
      await invoke("load_media", { path: filePath });
    } catch (e) {
      console.error(e);
    }

    if (!isImg) {
      setIsPlaying(true);
      await invoke("toggle_play", { pause: false });
    } else {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    const unlistenOpen = listen<string>("open-file-cli", (event) => {
      loadMedia(event.payload);
    });

    const unlistenCorrupt = listen("file-corrupt-warning", () => {
      console.warn("⚠️ CORRUPT FILE DETECTED! MPV decoding errors exceeded threshold.");
      // The user opted to not build the frontend modal right now.
      // A future update will display the Corrupt File Wizard UI here.
      alert("This file appears to be severely corrupted or truncated.\nPlayback has been paused to prevent visual artifacts.");
    });

    return () => {
      unlistenOpen.then(f => f());
      unlistenCorrupt.then(f => f());
    };
  }, []);

  useEffect(() => {
    invoke("set_volume", { volume: isMuted ? 0.0 : volume });
    invoke("set_speed", { speed: playbackSpeed });
    invoke("set_loop", { loopPlay: loop });
  }, [volume, isMuted, playbackSpeed, loop]);

  useEffect(() => {
    appWindow.setAlwaysOnTop(alwaysOnTop);
  }, [alwaysOnTop]);

  useEffect(() => {
    if (!isPlaying || !isAudioFile) return;

    const colors = ['--theme-pink', '--theme-peach', '--theme-yellow', '--theme-lightpink'];
    let timeoutId: number;
    let isActive = true;

    const spawnBubble = () => {
      if (!isActive || !visualizerContainerRef.current) return;

      const b = document.createElement('div');
      
      const isBass = Math.random() > 0.7; 
      const size = isBass ? (Math.random() * 20 + 40) : (Math.random() * 20 + 15);
      
      b.className = 'absolute rounded-full mix-blend-screen pointer-events-none transition-all ease-in-out';
      b.style.left = `${Math.random() * 80 + 10}%`;
      b.style.top = `${Math.random() * 80 + 10}%`;
      b.style.width = `${size}vw`;
      b.style.height = `${size}vw`;
      b.style.backgroundColor = `var(${colors[bubbleIdCounter.current++ % 4]})`;
      b.style.filter = `blur(${Math.random() * 20 + 30}px)`;
      b.style.transform = 'translate(-50%, -50%) scale(0)';
      b.style.opacity = '0';
      
      const duration = isBass ? (Math.random() * 1000 + 2000) : (Math.random() * 1000 + 1000);
      b.style.transitionDuration = `${duration}ms`;

      visualizerContainerRef.current.appendChild(b);

      requestAnimationFrame(() => {
        b.style.transform = `translate(-50%, -50%) scale(${Math.random() * 0.5 + 1})`;
        b.style.opacity = `${Math.random() * 0.3 + 0.3}`;
      });

      setTimeout(() => {
        b.style.transform = 'translate(-50%, -50%) scale(1.5)';
        b.style.opacity = '0';
        setTimeout(() => {
          if (visualizerContainerRef.current?.contains(b)) {
             visualizerContainerRef.current.removeChild(b);
          }
        }, duration);
      }, duration / 2);

      const nextSpawnTime = Math.random() * 300 + 100;
      timeoutId = window.setTimeout(spawnBubble, nextSpawnTime);
    };

    spawnBubble();

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      if (visualizerContainerRef.current) {
         visualizerContainerRef.current.innerHTML = '';
      }
    };
  }, [isPlaying, isAudioFile]);

  useEffect(() => {
    const root = document.documentElement;
    const colors = THEMES[theme];
    if (colors) {
      root.style.setProperty('--theme-pink', colors[0]);
      root.style.setProperty('--theme-lightpink', colors[1]);
      root.style.setProperty('--theme-peach', colors[2]);
      root.style.setProperty('--theme-yellow', colors[3]);
    }
  }, [theme]);

  useEffect(() => {
    if (!autoCycle) return;
    const timer = setInterval(() => {
      setTheme(current => {
        const idx = THEME_NAMES.indexOf(current);
        return THEME_NAMES[(idx + 1) % THEME_NAMES.length];
      });
    }, cycleInterval * 1000);
    return () => clearInterval(timer);
  }, [autoCycle, cycleInterval]);

  useEffect(() => {
    const handleMouseMove = () => {
      setIsHovering(true);
      if (hoverTimeoutTimer.current) clearTimeout(hoverTimeoutTimer.current);

      hoverTimeoutTimer.current = window.setTimeout(() => {
        if (isPlaying || isImage) setIsHovering(false);
      }, 2500);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hoverTimeoutTimer.current) clearTimeout(hoverTimeoutTimer.current);
    };
  }, [isPlaying, isImage]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!mediaUrl) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === "ArrowRight") {
        if (!isImage) {
           invoke("seek_media", { position: 5.0 }); // relative seek not implemented, but let's just trigger something for now or ignore
        }
      } else if (e.code === "ArrowLeft") {
        if (!isImage) {
           invoke("seek_media", { position: -5.0 }); 
        }
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(v => {
          const newVal = Math.min(v + 0.05, 1);
          if (newVal > 0) setIsMuted(false);
          return newVal;
        });
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(v => {
          const newVal = Math.max(v - 0.05, 0);
          if (newVal === 0) setIsMuted(true);
          return newVal;
        });
      } else if (e.key.toLowerCase() === "m") {
        toggleMute();
      } else if (e.key.toLowerCase() === "f") {
        const isFull = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!isFull);
        setIsFullscreen(!isFull);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mediaUrl, isPlaying, isImage]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00:00";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    // With MPV we'd need to poll properties or listen to events, omitted for simplicity in this PoC
  };

  const handleLoadedMetadata = () => {
  };

  const togglePlayPause = async () => {
    if (!isImage) {
      const newIsPlaying = !isPlaying;
      setIsPlaying(newIsPlaying);
      await invoke("toggle_play", { pause: !newIsPlaying });
    }
  };

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await invoke("set_volume", { volume: newMuted ? 0.0 : volume });
  };

  const openFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'All Media',
          extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'jpg', 'jpeg', 'png', 'webp', 'gif', '*']
        }]
      });

      if (selected) {
        loadMedia(selected as string);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isImage) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      // absolute seek requires knowing duration, omitting logic for now
      // await invoke("seek_media", { position: pos * durationSeconds });
    }
  };

  return (
    <div className="relative w-full h-full bg-transparent text-lux-yellow flex flex-col font-sans overflow-hidden group">

      {/* Brightness Overlay */}
      <div
        className="absolute inset-0 bg-black pointer-events-none z-40 transition-opacity duration-300"
        style={{ opacity: 1 - brightness }}
      />

      {/* Custom Titlebar */}
      <div
        className={`absolute top-0 w-full h-12 flex justify-between items-center px-4 z-50 transition-opacity duration-300 drag-region ${(!isFullscreen && isHovering) ? 'opacity-100 bg-gradient-to-b from-black/90 to-transparent' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="text-sm font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-lux-pink via-lux-peach to-lux-yellow pointer-events-none select-none truncate max-w-[60vw]">
          {currentFileName ? `NIRO MEDIA • ${currentFileName.toUpperCase()}` : "NIRO MEDIA"}
        </div>
        {type() !== "macos" && (
          <div className="flex gap-2 shrink-0 no-drag-region">
            <button onClick={() => appWindow.minimize()} className="p-2 hover:bg-lux-pink/10 text-lux-peach rounded-lg transition-colors cursor-pointer">
              <Minus size={15} />
            </button>
            <button onClick={async () => {
              const isMax = await appWindow.isMaximized();
              if (isMax) { appWindow.unmaximize(); setIsMaxState(false); }
              else { appWindow.maximize(); setIsMaxState(true); }
            }} className="p-2 hover:bg-lux-pink/10 text-lux-peach rounded-lg transition-colors cursor-pointer">
              {isMaxState ? <Minimize size={15} /> : <Square size={15} />}
            </button>
            <button onClick={() => appWindow.close()} className="p-2 hover:bg-[#FE81D4] hover:text-black text-lux-pink rounded-lg transition-colors cursor-pointer">
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center relative bg-transparent no-drag-region w-full h-full" onClick={togglePlayPause}>
        {mediaUrl ? (
          isImage ? (
            <img
              src={mediaUrl}
              alt="Media"
              className="w-full h-full object-contain select-none"
              onDoubleClick={async () => {
                const isFull = await appWindow.isFullscreen();
                await appWindow.setFullscreen(!isFull);
                setIsFullscreen(!isFull);
              }}
            />
          ) : (
            <>
              {isAudioFile && (
                <div 
                  ref={visualizerContainerRef} 
                  className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none z-0 bg-transparent"
                />
              )}
              {/* Native MPV Video renders underneath. No HTML Video tag needed. */}
              <div 
                className="w-full h-full absolute inset-0 z-0 bg-transparent"
                onDoubleClick={async () => {
                  const isFull = await appWindow.isFullscreen();
                  await appWindow.setFullscreen(!isFull);
                  setIsFullscreen(!isFull);
                }}
              />
            </>
          )
        ) : (
          <div className="text-center space-y-6 z-10 transition-transform hover:scale-105 duration-500">
            <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-lux-pink via-lux-lightpink to-lux-peach p-[2px] mx-auto shadow-[0_0_60px_-15px_rgba(254,129,212,0.6)]">
              <div className="w-full h-full bg-[#0a0a0a] rounded-[2rem] flex items-center justify-center">
                <Play className="text-lux-peach translate-x-1" size={48} strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-light text-lux-yellow tracking-widest uppercase">Ready for Playback</h2>
              <p className="text-sm tracking-wider text-lux-peach/60 uppercase font-light">Drag a file or click to browse</p>
            </div>

            <div className="pt-8 flex gap-4 justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); openFile(); }}
                className="px-8 py-3 rounded-full bg-gradient-to-r from-lux-pink to-lux-peach text-black font-bold tracking-widest uppercase text-xs hover:shadow-[0_0_25px_rgba(254,129,212,0.5)] hover:scale-105 transition-all cursor-pointer"
              >
                Open File
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await invoke<string>("register_default_app");
                    setRegStatus(res);
                    setTimeout(() => setRegStatus(""), 3000);
                  } catch (error: any) {
                    setRegStatus(error.toString());
                    setTimeout(() => setRegStatus(""), 3000);
                  }
                }}
                className="px-6 py-3 border border-lux-peach/30 text-lux-peach hover:bg-lux-peach/10 rounded-full transition-all text-xs font-bold tracking-widest uppercase backdrop-blur-md cursor-pointer flex items-center gap-2"
              >
                <MonitorDown size={16} /> Set as Default
              </button>
            </div>
            {regStatus && <div className="text-xs font-bold tracking-wider text-lux-pink mt-4 animate-pulse">{regStatus}</div>}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 w-full p-6 z-50 transition-all duration-300 ease-out transform no-drag-region ${isHovering && mediaUrl ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-5xl mx-auto bg-black/50 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-4 flex items-center gap-6 shadow-2xl">
          <button
            onClick={isImage ? openFile : togglePlayPause}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isImage ? 'bg-white/10 text-lux-yellow hover:bg-white/20' : 'bg-gradient-to-tr from-lux-pink to-lux-peach text-black shadow-[0_0_20px_rgba(254,129,212,0.3)] hover:scale-110 cursor-pointer'}`}
          >
            {isImage ? <ImageIcon size={22} className="text-lux-peach" /> : (isPlaying ? <Pause size={22} className="fill-current" /> : <Play size={22} className="fill-current translate-x-0.5" />)}
          </button>

          {!isImage && (
            <div className="flex-1 flex items-center gap-5">
              <span className="text-xs font-bold tracking-widest text-lux-peach/60 w-14 text-right">{currentTime}</span>
              <div
                className="h-2 flex-1 bg-white/5 rounded-full cursor-pointer relative group/slider border border-white/5 overflow-hidden"
                onClick={handleSeek}
              >
                {/* Progress bar */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-lux-pink to-lux-yellow rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(254,129,212,0.8)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-bold tracking-widest text-lux-peach/60 w-14">{duration}</span>
            </div>
          )}

          {isImage && (
            <div className="flex-1 text-center font-bold tracking-widest text-lux-peach/70 text-sm">
              IMAGE VIEWER MODE
            </div>
          )}

          <div className="flex gap-6 items-center text-lux-lightpink pl-6 border-l border-white/10">
            {!isImage && (
              <div
                className="relative flex items-center"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button className="hover:text-lux-yellow transition-colors hover:scale-110 transform cursor-pointer z-10" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                </button>

                <div className={`overflow-hidden transition-all duration-300 ease-out flex items-center ${showVolumeSlider ? 'w-24 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
                  <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (val > 0 && isMuted) setIsMuted(false);
                      else if (val === 0 && !isMuted) setIsMuted(true);
                    }}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-lux-pink"
                  />
                </div>
              </div>
            )}

            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowBrightnessSlider(true)}
              onMouseLeave={() => setShowBrightnessSlider(false)}
            >
              <button className="hover:text-lux-yellow transition-colors hover:scale-110 transform cursor-pointer z-10" onClick={() => setBrightness(brightness > 0.5 ? 0.2 : 1)}>
                <Sun size={22} />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ease-out flex items-center ${showBrightnessSlider ? 'w-24 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
                <input
                  type="range"
                  min="0.1" max="1" step="0.01"
                  value={brightness}
                  onChange={(e) => setBrightness(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-lux-yellow"
                />
              </div>
            </div>

            <button
              className="hover:text-lux-yellow transition-colors hover:scale-110 transform cursor-pointer"
              onClick={async () => {
                const isFull = await appWindow.isFullscreen();
                await appWindow.setFullscreen(!isFull);
                setIsFullscreen(!isFull);
              }}
            >
              {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
            </button>
            <button
              className="hover:text-lux-yellow transition-colors hover:scale-110 transform cursor-pointer relative"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={22} className={showSettings ? "text-lux-yellow animate-spin-slow" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal Panel */}
      <div
        className={`absolute right-8 bottom-28 w-64 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 z-40 transition-all duration-300 transform no-drag-region ${showSettings ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lux-peach font-bold tracking-widest text-xs uppercase">Playback Settings</h3>
          <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-lux-pink transition-colors cursor-pointer">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="flex justify-between items-center group cursor-pointer" onClick={() => setAlwaysOnTop(!alwaysOnTop)}>
            <span className="text-sm tracking-wider text-lux-lightpink group-hover:text-lux-yellow transition-colors">Always on Top</span>
            <div className={`w-8 h-4 rounded-full transition-colors relative ${alwaysOnTop ? 'bg-lux-pink' : 'bg-white/20'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all transform ${alwaysOnTop ? 'left-4' : 'left-0.5'}`} />
            </div>
          </div>

          <div className="flex justify-between items-center group cursor-pointer" onClick={() => setLoop(!loop)}>
            <span className="text-sm tracking-wider text-lux-lightpink group-hover:text-lux-yellow transition-colors">Loop Playback</span>
            <div className={`w-8 h-4 rounded-full transition-colors relative ${loop ? 'bg-lux-pink' : 'bg-white/20'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all transform ${loop ? 'left-4' : 'left-0.5'}`} />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-white/10 pb-2">
            <span className="text-xs tracking-wider text-lux-lightpink/80 block uppercase font-bold">Speed ({playbackSpeed}x)</span>
            <input
              type="range"
              min="0.25" max="2" step="0.25"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-lux-pink"
            />
            <div className="flex justify-between text-[10px] text-lux-peach/50 uppercase tracking-widest font-bold">
              <span>0.25x</span>
              <span>1x</span>
              <span>2x</span>
            </div>
          </div>

          <div className="space-y-4 pt-3 border-t border-white/10">
            <div className="flex justify-between items-center text-xs tracking-wider text-lux-lightpink/80 uppercase font-bold">
              <span>Theme Color</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} className="bg-white/10 text-lux-yellow rounded px-2 py-1 outline-none cursor-pointer max-w-[120px] truncate text-right border-none focus:ring-1 focus:ring-lux-pink">
                {THEME_NAMES.map(t => <option key={t} value={t} className="bg-[#0a0a0a] text-white">{t.toUpperCase()}</option>)}
              </select>
            </div>

            <div className="flex justify-between items-center group cursor-pointer" onClick={() => setAutoCycle(!autoCycle)}>
              <span className="text-sm tracking-wider text-lux-lightpink group-hover:text-lux-yellow transition-colors">Auto-Cycle Theme</span>
              <div className={`w-8 h-4 rounded-full transition-colors relative ${autoCycle ? 'bg-lux-pink' : 'bg-white/20'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all transform ${autoCycle ? 'left-4' : 'left-0.5'}`} />
              </div>
            </div>

            {autoCycle && (
              <div className="flex justify-between items-center animate-pulse">
                <span className="text-xs tracking-wider text-lux-lightpink/60">Interval ({cycleInterval}s)</span>
                <input type="range" min="5" max="60" step="5" value={cycleInterval} onChange={e => setCycleInterval(parseInt(e.target.value))} className="w-1/2 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-lux-yellow" />
              </div>
            )}
          </div>
          
          <div className="space-y-2 pt-3 border-t border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-xs tracking-wider text-lux-lightpink/80 uppercase font-bold">Recent Media</span>
              {recentFiles.length > 0 && (
                <button onClick={() => setRecentFiles([])} className="text-[9px] tracking-widest uppercase text-lux-peach/40 hover:text-lux-pink transition-colors cursor-pointer">Clear All</button>
              )}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg bg-black/40 p-1">
              {recentFiles.length === 0
                ? <div className="text-[10px] text-lux-peach/30 text-center py-3 tracking-widest">No recent media.</div>
                : recentFiles.map(file => (
                  <div key={file.path} className="flex items-center gap-1 group/item rounded hover:bg-white/10 transition-colors">
                    <button
                      onClick={() => { loadMedia(file.path); setShowSettings(false); }}
                      className="flex-1 text-left text-[10px] text-lux-lightpink/70 group-hover/item:text-lux-yellow p-1.5 truncate transition-colors cursor-pointer"
                      title={file.path}
                    >
                      {file.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRecentFiles(prev => prev.filter(f => f.path !== file.path)); }}
                      className="shrink-0 p-1 opacity-0 group-hover/item:opacity-100 hover:text-red-400 text-lux-peach/50 transition-all cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))
              }
            </div>
          </div>


          <div className="pt-4 border-t border-white/10 text-center">
            <div className="text-[10px] tracking-[0.2em] text-lux-peach/40 uppercase font-bold mb-1">Produced & Owned by</div>
            <div className="text-xs tracking-widest text-lux-yellow font-black mb-2">ESTHERMINDS</div>
            <div className="text-[9px] tracking-wider text-lux-peach/30 uppercase">© 2026 NIRO MEDIA. All rights reserved.</div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
