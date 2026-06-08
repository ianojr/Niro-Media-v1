import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Settings, List, Maximize, Minimize, Captions, Repeat, Camera, ListMusic, SkipBack, SkipForward, Activity } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "../App.css";

interface Telemetry {
  time: number;
  duration: number;
  paused: boolean;
  hwdec: string;
  vformat: string;
  vid: string;
  sig_peak: number;
  fps: number;
  dropped_frames: number;
  av_sync: number;
  playlist_pos: number;
  playlist_count: number;
  current_filename: string;
  upscale_mode: string;
}

export default function ControlBar({
  showSettings, setShowSettings,
  showChapters, setShowChapters,
  showTracks, setShowTracks,
  showPlaylist, setShowPlaylist,
  showVisualizers, setShowVisualizers,
  isIdle, vformat
}: {
  showSettings: boolean; setShowSettings: (s: boolean) => void;
  showChapters: boolean; setShowChapters: (s: boolean) => void;
  showTracks: boolean; setShowTracks: (s: boolean) => void;
  showPlaylist: boolean; setShowPlaylist: (s: boolean) => void;
  showVisualizers: boolean; setShowVisualizers: (s: boolean) => void;
  isIdle: boolean;
  vformat: string;
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
  const [playlistCount, setPlaylistCount] = useState(0);

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
      if (event.payload.playlist_count !== undefined) {
        setPlaylistCount(event.payload.playlist_count);
      }
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
        case 'n':
          e.preventDefault();
          await invoke("playlist_next");
          showOsd("Next Track");
          break;
        case 'p':
          e.preventDefault();
          await invoke("playlist_prev");
          showOsd("Previous Track");
          break;
        case 'i':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('show-stats'));
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
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: isIdle ? 0 : 1, y: isIdle ? 100 : 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`absolute bottom-0 left-0 w-full z-50 glass-panel border-t border-b-0 border-x-0 !rounded-none p-4 flex items-center gap-6 no-drag-region ${isIdle ? 'pointer-events-none' : ''}`}
    >
      <div className="flex gap-2 shrink-0 border-r border-[rgba(255,255,255,0.1)] pr-6">
        {playlistCount > 1 && (
          <button
            onClick={async () => { await invoke("playlist_prev"); showOsd("Previous Track"); }}
            className="w-10 h-10 shrink-0 flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-all cursor-pointer"
            title="Previous Track"
          >
            <SkipBack size={16} />
          </button>
        )}

        <button
          onClick={togglePlayPause}
          className="w-10 h-10 shrink-0 bg-[var(--color-pink)] flex items-center justify-center text-black shadow-[0_0_20px_rgba(254,129,212,0.4)] hover:scale-105 transition-transform cursor-pointer"
        >
          {isPlaying ? <Pause size={18} className="fill-black" /> : <Play size={18} className="fill-black translate-x-0.5" />}
        </button>

        {playlistCount > 1 && (
          <button
            onClick={async () => { await invoke("playlist_next"); showOsd("Next Track"); }}
            className="w-10 h-10 shrink-0 flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-all cursor-pointer"
            title="Next Track"
          >
            <SkipForward size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center gap-4 group">
        <span className="text-[10px] font-mono tracking-[0.2em] text-[var(--color-yellow)] w-16 text-right select-none">{currentTime}</span>
        
        <div 
          className="h-1 flex-1 bg-[rgba(255,255,255,0.1)] cursor-pointer relative overflow-visible"
          onClick={handleSeek}
        >
          <div
            className="absolute top-0 left-0 h-full bg-[var(--color-pink)] transition-all duration-100 ease-linear shadow-[0_0_10px_var(--color-pink)]"
            style={{ width: `${progress}%` }}
          />
          {/* Seek Scrubber Dot */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-[var(--color-pink)] rounded-none shadow-[0_0_15px_var(--color-pink)] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        
        <span className="text-[10px] font-mono tracking-[0.2em] text-[var(--text-secondary)] w-16 select-none">{durationStr}</span>
      </div>

      <div className="flex gap-4 items-center text-[var(--text-secondary)] pl-6 border-l border-[rgba(255,255,255,0.1)]">
        
        <div
          className="relative flex items-center"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button className="hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer z-10" onClick={toggleMute}>
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
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
          <Camera size={16} />
        </button>

        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${isLooping ? 'text-[var(--color-pink)]' : ''}`}
          onClick={toggleLoop}
          title="Toggle Repeat"
        >
          <Repeat size={16} />
        </button>

        {vformat === "Unknown" && (
          <button
            className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showVisualizers ? 'text-[var(--color-peach)] text-glow' : ''}`}
            onClick={() => { setShowVisualizers(!showVisualizers); setShowSettings(false); setShowChapters(false); setShowTracks(false); setShowPlaylist(false); }}
            title="Audio Visualizers"
          >
            <Activity size={16} />
          </button>
        )}

        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showTracks ? 'text-[var(--color-peach)]' : ''}`}
          onClick={() => { setShowTracks(!showTracks); setShowSettings(false); setShowChapters(false); setShowVisualizers(false); setShowPlaylist(false); }}
          title="Subtitles & Audio"
        >
          <Captions size={16} />
        </button>

        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showChapters ? 'text-[var(--color-yellow)]' : ''}`}
          onClick={() => { setShowChapters(!showChapters); setShowSettings(false); setShowTracks(false); setShowVisualizers(false); setShowPlaylist(false); }}
          title="Chapters"
        >
          <List size={16} />
        </button>
        
        <button
          className={`relative hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showPlaylist ? 'text-[var(--color-pink)]' : ''}`}
          onClick={() => { setShowPlaylist(!showPlaylist); setShowSettings(false); setShowChapters(false); setShowTracks(false); setShowVisualizers(false); }}
          title="Playlist"
        >
          <ListMusic size={16} />
          {playlistCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[var(--color-pink)] text-black text-[8px] font-bold w-4 h-4 flex items-center justify-center shadow-[0_0_8px_rgba(254,129,212,0.5)]">
              {playlistCount > 99 ? '99+' : playlistCount}
            </span>
          )}
        </button>

        <button
          className={`hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer ${showSettings ? 'text-[var(--color-yellow)] rotate-90' : ''}`}
          onClick={() => { setShowSettings(!showSettings); setShowChapters(false); setShowTracks(false); setShowPlaylist(false); setShowVisualizers(false); }}
          title="Settings"
        >
          <Settings size={16} />
        </button>

        <button
          className="hover:text-[var(--color-yellow)] transition-colors hover:scale-110 transform cursor-pointer"
          onClick={toggleFullscreen}
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>
    </motion.div>
  );
}
