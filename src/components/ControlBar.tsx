import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Settings, List, Maximize, Minimize, Captions, Repeat, Camera } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "../App.css";

interface Telemetry {
  time: number;
  duration: number;
  paused: boolean;
}

export default function ControlBar({
  showSettings,
  setShowSettings,
  showChapters,
  setShowChapters,
  showTracks,
  setShowTracks,
  isIdle
}: {
  showSettings: boolean;
  setShowSettings: (s: boolean) => void;
  showChapters: boolean;
  setShowChapters: (s: boolean) => void;
  showTracks: boolean;
  setShowTracks: (s: boolean) => void;
  isIdle: boolean;
}) {
  const appWindow = getCurrentWindow();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00:00");
  const [durationStr, setDurationStr] = useState("0:00:00");
  const [durationSecs, setDurationSecs] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  const showOsd = (message: string) => {
    window.dispatchEvent(new CustomEvent('show-osd', { detail: message }));
  };
  
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00:00";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const unlisten = listen<Telemetry>("time-update", (event) => {
      setIsPlaying(!event.payload.paused);
      if (event.payload.duration > 0) {
        setProgress((event.payload.time / event.payload.duration) * 100);
        const remaining = event.payload.duration - event.payload.time;
        setDurationStr("-" + formatTime(remaining > 0 ? remaining : 0));
      }
      setCurrentTime(formatTime(event.payload.time));
      setDurationSecs(event.payload.duration);
    });

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch(e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          await togglePlayPause();
          break;
        case 'f':
          e.preventDefault();
          await toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          await toggleMute();
          break;
        case 'arrowright':
          e.preventDefault();
          if (durationSecs > 0) {
            const currentPos = (progress / 100) * durationSecs;
            await invoke("seek_media", { position: currentPos + 5 });
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          if (durationSecs > 0) {
            const currentPos = (progress / 100) * durationSecs;
            await invoke("seek_media", { position: Math.max(0, currentPos - 5) });
          }
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(v => {
            const newVol = Math.min(1, v + 0.05);
            invoke("set_volume", { volume: newVol });
            showOsd(`Volume: ${Math.round(newVol * 100)}%`);
            if (newVol > 0 && isMuted) setIsMuted(false);
            return newVol;
          });
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(v => {
            const newVol = Math.max(0, v - 0.05);
            invoke("set_volume", { volume: newVol });
            showOsd(`Volume: ${Math.round(newVol * 100)}%`);
            if (newVol === 0 && !isMuted) setIsMuted(true);
            return newVol;
          });
          break;
      }
    };

    let wheelTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastWheelInvoke = 0;

    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.glass-panel') || (e.target as HTMLElement).closest('.settings-panel') || (e.target as HTMLElement).closest('.chapter-menu')) return;
      
      e.preventDefault();
      setVolume(v => {
        const newVol = Math.max(0, Math.min(1, v + (e.deltaY < 0 ? 0.05 : -0.05)));
        
        const now = Date.now();
        if (now - lastWheelInvoke > 50) {
            invoke("set_volume", { volume: newVol });
            lastWheelInvoke = now;
        } else {
            if (wheelTimeout) clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => {
                invoke("set_volume", { volume: newVol });
            }, 50);
        }

        showOsd(`Volume: ${Math.round(newVol * 100)}%`);
        if (newVol > 0 && isMuted) setIsMuted(false);
        if (newVol === 0 && !isMuted) setIsMuted(true);
        return newVol;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      unlisten.then((f) => f());
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [durationSecs, progress, isMuted, volume]);

  const togglePlayPause = async () => {
    await invoke("toggle_pause");
  };

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await invoke("set_volume", { volume: newMuted ? 0.0 : volume });
    showOsd(newMuted ? "Muted" : `Volume: ${Math.round(volume * 100)}%`);
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0 && isMuted) setIsMuted(false);
    else if (val === 0 && !isMuted) setIsMuted(true);
    await invoke("set_volume", { volume: val });
    showOsd(`Volume: ${Math.round(val * 100)}%`);
  };

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (durationSecs > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      await invoke("seek_media", { position: pos * durationSecs });
      showOsd(formatTime(pos * durationSecs));
    }
  };

  const toggleFullscreen = async () => {
    const isFull = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFull);
    setIsFullscreen(!isFull);
    showOsd(!isFull ? "Fullscreen" : "Windowed");
  };

  const toggleLoop = async () => {
    const next = !isLooping;
    setIsLooping(next);
    await invoke("set_loop", { loopPlay: next });
    showOsd(next ? "Looping: On" : "Looping: Off");
  };

  const takeScreenshot = async () => {
    // Generate a timestamped filename in the user's Pictures folder (or let backend handle it)
    // For now, let's just pass a default name and the backend can save it. Wait, the backend screenshot command takes a path.
    // Let's use the tauri path API to get Pictures dir.
    try {
      const { pictureDir, join } = await import('@tauri-apps/api/path');
      const dir = await pictureDir();
      const filename = `NiroMedia_${Date.now()}.png`;
      const fullPath = await join(dir, filename);
      await invoke("take_screenshot", { path: fullPath, includeSubtitles: true });
      showOsd("Screenshot Saved");
    } catch (e) {
      console.error(e);
      showOsd("Screenshot Failed");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: isIdle ? 0 : 1, y: isIdle ? 50 : 0 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-5xl z-50 glass-panel rounded-3xl p-4 flex items-center gap-6 no-drag-region ${isIdle ? 'pointer-events-none' : ''}`}
    >
      <button
        onClick={togglePlayPause}
        className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-tr from-[var(--color-pink)] to-[var(--color-peach)] flex items-center justify-center text-black shadow-[0_0_20px_rgba(254,129,212,0.4)] hover:scale-110 transition-transform cursor-pointer"
      >
        {isPlaying ? <Pause size={20} className="fill-black" /> : <Play size={20} className="fill-black translate-x-0.5" />}
      </button>

      <div className="flex-1 flex items-center gap-4">
        <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] w-14 text-right select-none">{currentTime}</span>
        
        <div 
          className="h-2 flex-1 bg-[rgba(255,255,255,0.05)] rounded-full cursor-pointer relative group overflow-hidden border border-[rgba(255,255,255,0.05)]"
          onClick={handleSeek}
        >
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--color-pink)] to-[var(--color-yellow)] rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_var(--color-pink)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] w-14 select-none">{durationStr}</span>
      </div>

      <div className="flex gap-4 items-center text-[var(--text-secondary)] pl-4 border-l border-[rgba(255,255,255,0.1)]">
        
        <div
          className="relative flex items-center"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button className="hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer z-10" onClick={toggleMute}>
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <div className={`overflow-hidden transition-all duration-300 ease-out flex items-center ${showVolumeSlider ? 'w-20 opacity-100 ml-3' : 'w-0 opacity-0 ml-0'}`}>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
            />
          </div>
        </div>

        <button
          className="hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer"
          onClick={takeScreenshot}
          title="Take Screenshot"
        >
          <Camera size={18} />
        </button>

        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${isLooping ? 'text-[var(--color-pink)]' : ''}`}
          onClick={toggleLoop}
          title="Toggle Repeat"
        >
          <Repeat size={18} />
        </button>

        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showTracks ? 'text-[var(--color-peach)]' : ''}`}
          onClick={() => { setShowTracks(!showTracks); setShowSettings(false); setShowChapters(false); }}
          title="Subtitles & Audio"
        >
          <Captions size={18} />
        </button>

        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showChapters ? 'text-[var(--color-yellow)]' : ''}`}
          onClick={() => { setShowChapters(!showChapters); setShowSettings(false); setShowTracks(false); }}
          title="Chapters"
        >
          <List size={18} />
        </button>
        
        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showSettings ? 'text-[var(--color-yellow)] rotate-90' : ''}`}
          onClick={() => { setShowSettings(!showSettings); setShowChapters(false); setShowTracks(false); }}
          title="Settings"
        >
          <Settings size={18} />
        </button>

        <button
          className="hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer"
          onClick={toggleFullscreen}
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
    </motion.div>
  );
}
