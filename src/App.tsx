import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import { Play, FolderOpen } from "lucide-react";
import HardwareBadge from "./components/HardwareBadge";
import ControlBar from "./components/ControlBar";
import SettingsPanel from "./components/SettingsPanel";
import ChapterMenu from "./components/ChapterMenu";
import TrackMenu from "./components/TrackMenu";
import PlaylistPanel from "./components/PlaylistPanel";
import VisualizerMenu from "./components/VisualizerMenu";
import OSD from "./components/OSD";
import CorruptModal from "./components/CorruptModal";
import "./App.css";

export default function App() {
  const [hasMedia, setHasMedia] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showTracks, setShowTracks] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showVisualizers, setShowVisualizers] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [vformat, setVformat] = useState("Loading");
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const handleMouseMove = () => {
      setIsIdle(false);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 3000); // 3 seconds to hide UI
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const unlistenTime = listen<any>("time-update", (e) => {
      if (e.payload.vformat) {
        setVformat(e.payload.vformat);
      }
    });

    // Handle drag-and-drop using Tauri v2's native window API
    const unlistenDragDrop = appWindow.onDragDropEvent((event) => {
      if (event.payload.type === "enter") {
        setIsDragOver(true);
      } else if (event.payload.type === "leave") {
        setIsDragOver(false);
      } else if (event.payload.type === "drop") {
        setIsDragOver(false);
        const paths = event.payload.paths;
        const mediaExts = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'mka'];
        const subtitleExts = ['srt', 'ass', 'ssa', 'vtt', 'sub', 'idx'];
        
        const mediaPaths = paths.filter((p: string) => {
          const ext = p.split('.').pop()?.toLowerCase() || '';
          return mediaExts.includes(ext);
        });
        const subtitlePaths = paths.filter((p: string) => {
          const ext = p.split('.').pop()?.toLowerCase() || '';
          return subtitleExts.includes(ext);
        });

        // Load subtitle files onto the current video
        if (subtitlePaths.length > 0 && hasMedia) {
          for (const subPath of subtitlePaths) {
            invoke("load_subtitle", { path: subPath }).catch(console.error);
          }
        }

        // Load media files
        if (mediaPaths.length === 1) {
          loadMedia(mediaPaths[0]);
        } else if (mediaPaths.length > 1) {
          loadMultipleFiles(mediaPaths);
        }
      }
    });

    return () => {
      unlistenTime.then(f => f());
      unlistenDragDrop.then(f => f());
    };
  }, []);

  const loadMedia = async (filePath: string) => {
    try {
      await invoke("init_player");
      await invoke("load_media", { path: filePath });
      setHasMedia(true);
      await invoke("toggle_play", { pause: false });
    } catch (e) {
      alert("Error loading media: " + e);
    }
  };

  async function loadMultipleFiles(paths: string[]) {
    try {
      await invoke("init_player");
      await invoke("playlist_load_multiple", { paths });
      setHasMedia(true);
      await invoke("toggle_play", { pause: false });
    } catch (e) {
      console.error("Failed to load playlist:", e);
    }
  }

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const isFull = await appWindow.isFullscreen();
        if (isFull) {
          await appWindow.setFullscreen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const unlistenOpen = listen<string>("open-file-cli", (event) => {
      loadMedia(event.payload);
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenOpen.then(f => f());
    };
  }, []);

  const openFileDialog = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Media',
          extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'mp3', 'flac', 'mka']
        }]
      });
      if (selected) {
        loadMedia(selected as string);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openFolderDialog = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected) {
        const result = await invoke("scan_folder_for_episodes", { folderPath: selected as string }) as string;
        const episodes = JSON.parse(result);
        if (episodes.length > 0) {
          const paths = episodes.map((ep: any) => ep.filepath);
          await invoke("init_player");
          await invoke("playlist_load_multiple", { paths });
          setHasMedia(true);
          await invoke("toggle_play", { pause: false });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.glass-panel') || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.drag-region')) return;
    invoke("toggle_pause");
  };

  const handleBackgroundDoubleClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.glass-panel') || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.drag-region')) return;
    const isFull = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFull);
  };

  return (
    <div 
      className={`relative w-full h-screen text-[var(--text-primary)] flex flex-col items-center justify-center font-sans overflow-hidden transition-colors duration-1000 ${hasMedia ? 'bg-transparent' : 'bg-[var(--theme-base)]'} ${isIdle && hasMedia ? 'cursor-none' : ''} ${isDragOver ? 'ring-2 ring-[var(--accent-pink)] ring-inset' : ''}`}
      onClick={handleBackgroundClick}
      onDoubleClick={handleBackgroundDoubleClick}
    >

      {isDragOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          <div className="text-center">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-white text-2xl font-light">Drop files to play</p>
            <p className="text-white/50 text-sm mt-2">Drop multiple files to create a playlist</p>
          </div>
        </motion.div>
      )}
      
      {/* Titlebar Drag Region and Window Controls */}
      <div data-tauri-drag-region className={`absolute top-0 w-full h-12 z-[60] drag-region flex justify-end items-center px-6 gap-3 transition-opacity duration-500 ${isIdle && hasMedia ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button 
          className="no-drag-region w-[14px] h-[14px] rounded-full bg-[var(--color-yellow)] opacity-60 hover:opacity-100 hover:scale-110 transition-all cursor-pointer flex items-center justify-center shadow-[0_0_10px_rgba(254,236,129,0.3)]"
          onClick={async (e) => { e.stopPropagation(); await appWindow.minimize(); }}
          title="Minimize"
        />
        <button 
          className="no-drag-region w-[14px] h-[14px] rounded-full bg-[var(--color-peach)] opacity-60 hover:opacity-100 hover:scale-110 transition-all cursor-pointer flex items-center justify-center shadow-[0_0_10px_rgba(254,166,129,0.3)]"
          onClick={async (e) => { 
            e.stopPropagation(); 
            const isFull = await appWindow.isFullscreen();
            await appWindow.setFullscreen(!isFull);
          }}
          title="Fullscreen"
        />
        <button 
          className="no-drag-region w-[14px] h-[14px] rounded-full bg-[var(--color-pink)] opacity-60 hover:opacity-100 hover:scale-110 transition-all cursor-pointer flex items-center justify-center shadow-[0_0_10px_rgba(254,129,212,0.3)]"
          onClick={(e) => { e.stopPropagation(); appWindow.close(); }}
          title="Close"
        />
      </div>

      {/* Global Modals and HUD */}
      <OSD />
      <CorruptModal />
      {hasMedia && <HardwareBadge />}

      {/* Sidebars */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <ChapterMenu isOpen={showChapters} onClose={() => setShowChapters(false)} />
      <TrackMenu isOpen={showTracks} onClose={() => setShowTracks(false)} />
      <PlaylistPanel isOpen={showPlaylist} onClose={() => setShowPlaylist(false)} />
      <VisualizerMenu isOpen={showVisualizers} onClose={() => setShowVisualizers(false)} />

      {/* Main UI */}
      {!hasMedia ? (
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
          }}
          className="w-full max-w-4xl px-12 z-10 no-drag-region flex flex-col justify-center"
        >
          <motion.div variants={{ hidden: { opacity: 0, x: -50 }, visible: { opacity: 1, x: 0 } }}>
            <h1 className="text-8xl font-display font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-pink)] to-[var(--color-peach)] leading-none select-none mb-2">
              NIRO
            </h1>
            <h2 className="text-6xl font-display font-bold tracking-[0.2em] text-white/90 leading-none select-none">
              MEDIA
            </h2>
          </motion.div>
          
          <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="mt-8 h-[1px] w-full bg-gradient-to-r from-[var(--color-pink)] to-transparent opacity-50" />

          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="mt-8">
            <p className="text-sm font-mono text-[var(--color-yellow)] uppercase tracking-[0.3em] mb-8">
              System Ready <span className="opacity-50">/ Awaiting Input</span>
            </p>
            <div className="flex gap-4">
              <button
                onClick={openFileDialog}
                className="group relative px-8 py-4 bg-black/40 border border-[var(--color-pink)] hover:bg-[rgba(254,129,212,0.1)] transition-all cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-pink)] to-transparent opacity-0 group-hover:opacity-20 transition-opacity" />
                <span className="relative z-10 font-display text-sm tracking-[0.2em] font-bold text-white group-hover:text-[var(--color-pink)] flex items-center gap-3">
                  <Play size={16} /> LOAD FILE
                </span>
              </button>
              
              <button
                onClick={openFolderDialog}
                className="group relative px-8 py-4 bg-black/40 border border-[var(--theme-border)] hover:border-[var(--color-yellow)] hover:bg-[rgba(255,234,187,0.05)] transition-all cursor-pointer overflow-hidden"
              >
                <span className="relative z-10 font-display text-sm tracking-[0.2em] font-bold text-[var(--text-secondary)] group-hover:text-[var(--color-yellow)] flex items-center gap-3">
                  <FolderOpen size={16} /> SCAN FOLDER
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <>
          {/* Cyber-Elegance UI Overlay wrapper */}
          {vformat === "Unknown" && (
            <div className="absolute top-12 left-6 text-xs font-mono text-[var(--color-pink)] opacity-50 tracking-[0.3em] uppercase pointer-events-none z-0">
              AUDIO MODE / VISUALIZER ACTIVE
            </div>
          )}

          <ControlBar 
            isIdle={isIdle} 
            vformat={vformat}
            showSettings={showSettings} setShowSettings={setShowSettings}
            showChapters={showChapters} setShowChapters={setShowChapters}
            showTracks={showTracks} setShowTracks={setShowTracks}
            showPlaylist={showPlaylist} setShowPlaylist={setShowPlaylist}
            showVisualizers={showVisualizers} setShowVisualizers={setShowVisualizers}
          />
        </>
      )}
      
    </div>
  );
}
