import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import HardwareBadge from "./components/HardwareBadge";
import ControlBar from "./components/ControlBar";
import SettingsPanel from "./components/SettingsPanel";
import ChapterMenu from "./components/ChapterMenu";
import TrackMenu from "./components/TrackMenu";
import OSD from "./components/OSD";
import CorruptModal from "./components/CorruptModal";
import "./App.css";

export default function App() {
  const [hasMedia, setHasMedia] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showTracks, setShowTracks] = useState(false);
  const [vformat, setVformat] = useState("Loading");
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const unlistenTime = listen<any>("time-update", (e) => {
      if (e.payload.vformat) {
        setVformat(e.payload.vformat);
      }
    });
    return () => {
      unlistenTime.then(f => f());
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
      className={`relative w-full h-screen text-[var(--text-primary)] flex flex-col items-center justify-center font-sans overflow-hidden transition-colors duration-1000 ${hasMedia ? 'bg-transparent' : 'bg-[var(--theme-base)]'}`}
      onClick={handleBackgroundClick}
      onDoubleClick={handleBackgroundDoubleClick}
    >
      
      {/* Titlebar Drag Region and Window Controls */}
      <div data-tauri-drag-region className="absolute top-0 w-full h-12 z-[60] drag-region flex justify-end items-center px-6 gap-3">
        <button 
          className="no-drag-region w-[14px] h-[14px] rounded-full bg-[var(--color-yellow)] opacity-60 hover:opacity-100 hover:scale-110 transition-all cursor-pointer flex items-center justify-center shadow-[0_0_10px_rgba(254,236,129,0.3)]"
          onClick={async (e) => { e.stopPropagation(); await appWindow.minimize(); }}
          title="Minimize"
        />
        <button 
          className="no-drag-region w-[14px] h-[14px] rounded-full bg-[var(--color-peach)] opacity-60 hover:opacity-100 hover:scale-110 transition-all cursor-pointer flex items-center justify-center shadow-[0_0_10px_rgba(254,166,129,0.3)]"
          onClick={async (e) => { 
            e.stopPropagation(); 
            const isMax = await appWindow.isMaximized();
            if (isMax) await appWindow.unmaximize();
            else await appWindow.maximize();
          }}
          title="Maximize"
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

      {/* Main UI */}
      {!hasMedia ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8 z-10 no-drag-region"
        >
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[var(--color-pink)] to-[var(--color-yellow)] p-[2px] mx-auto shadow-[0_0_80px_rgba(254,129,212,0.4)]">
            <div className="w-full h-full bg-[var(--theme-base)] rounded-full flex items-center justify-center cursor-pointer hover:bg-black/50 transition-colors" onClick={openFileDialog}>
              <Play className="text-[var(--color-peach)] translate-x-1" size={48} strokeWidth={1} />
            </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-pink)] via-[var(--color-peach)] to-[var(--color-yellow)] pointer-events-none select-none">
              NIRO MEDIA
            </h1>
            <p className="text-xs tracking-[0.4em] text-[var(--text-secondary)] uppercase">
              Engine Ready &bull; Awaiting Media
            </p>
          </div>

          <button
            onClick={openFileDialog}
            className="mt-8 px-10 py-4 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] text-xs font-bold tracking-[0.2em] uppercase transition-all cursor-pointer"
          >
            Open File
          </button>
        </motion.div>
      ) : (
        <>
          {/* Audio Visualizer Fallback (Only shows if MPV has no video output and window remains transparent) */}
          {vformat === "Unknown" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10 bg-black/60 backdrop-blur-3xl">
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {/* Dancing Glowing Orbs / Particles */}
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 0.9, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3, 0.8, 0.3],
                    rotate: [0, 90, 180, 270, 360]
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute w-[800px] h-[800px] rounded-full border border-[var(--color-pink)] opacity-30 mix-blend-screen"
                  style={{ boxShadow: "0 0 150px var(--color-pink), inset 0 0 100px var(--color-pink)" }}
                />
                <motion.div 
                  animate={{ 
                    scale: [0.8, 1.3, 1, 1.2, 0.8],
                    opacity: [0.2, 0.5, 0.2, 0.7, 0.2],
                    rotate: [360, 270, 180, 90, 0]
                  }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  className="absolute w-[600px] h-[600px] rounded-full border-[2px] border-[var(--color-yellow)] opacity-30 mix-blend-screen"
                  style={{ boxShadow: "0 0 120px var(--color-yellow), inset 0 0 80px var(--color-yellow)" }}
                />
                <motion.div 
                  animate={{ 
                    scale: [1.1, 0.9, 1.3, 0.8, 1.1],
                    opacity: [0.4, 0.8, 0.3, 0.9, 0.4]
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "anticipate" }}
                  className="absolute w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-[var(--color-pink)] to-[var(--color-peach)] mix-blend-screen blur-[100px]"
                />
                <div className="absolute flex flex-col items-center justify-center">
                  <div className="text-sm font-bold tracking-[0.5em] text-white/50 uppercase mb-4">Playing Audio</div>
                  <div className="flex gap-2 items-end h-16">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: ["10%", `${Math.random() * 80 + 20}%`, "10%"] }}
                        transition={{ duration: 0.4 + Math.random() * 0.4, repeat: Infinity, ease: "easeInOut" }}
                        className="w-2 bg-[var(--color-yellow)] rounded-full shadow-[0_0_10px_var(--color-yellow)]"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <ControlBar 
            showSettings={showSettings} 
            setShowSettings={setShowSettings}
            showChapters={showChapters}
            setShowChapters={setShowChapters}
            showTracks={showTracks}
            setShowTracks={setShowTracks}
          />
        </>
      )}
      
    </div>
  );
}
