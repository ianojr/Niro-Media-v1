import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";

interface StatsData {
  fps: number;
  dropped_frames: number;
  av_sync: number;
  vformat: string;
  hwdec: string;
  playlist_pos: number;
  playlist_count: number;
}

export default function OSD() {
  const [message, setMessage] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<StatsData>({
    fps: 0,
    dropped_frames: 0,
    av_sync: 0,
    vformat: "",
    hwdec: "",
    playlist_pos: 0,
    playlist_count: 0,
  });

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleShowOsd = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setMessage(customEvent.detail);
      setIsVisible(true);
      
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsVisible(false);
      }, 1500);
    };

    const handleShowStats = () => {
      setShowStats((prev) => !prev);
    };

    window.addEventListener("show-osd", handleShowOsd);
    window.addEventListener("show-stats", handleShowStats);
    return () => {
      window.removeEventListener("show-osd", handleShowOsd);
      window.removeEventListener("show-stats", handleShowStats);
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<any>("time-update", (event) => {
      const p = event.payload;
      setStats({
        fps: p.fps ?? 0,
        dropped_frames: p.dropped_frames ?? 0,
        av_sync: p.av_sync ?? 0,
        vformat: p.vformat ?? "",
        hwdec: p.hwdec ?? "",
        playlist_pos: p.playlist_pos ?? 0,
        playlist_count: p.playlist_count ?? 0,
      });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <>
      {/* Standard OSD Message */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(4px)" }}
            transition={{ duration: 0.2 }}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] px-6 py-3 rounded-full shadow-2xl">
              <span className="text-white text-sm font-bold tracking-widest uppercase text-glow">
                {message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overlay */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-16 left-4 z-50 pointer-events-none"
          >
            <div className="bg-[rgba(0,0,0,0.75)] backdrop-blur-sm border border-[rgba(255,255,255,0.08)] rounded-xl px-5 py-4 shadow-2xl">
              <div className="text-[10px] font-bold tracking-[0.2em] text-[var(--color-yellow)] uppercase mb-3">
                Playback Stats
              </div>
              <div className="font-mono text-xs space-y-1.5 text-[rgba(255,255,255,0.8)]">
                <div className="flex justify-between gap-8">
                  <span className="text-[var(--text-secondary)]">FPS</span>
                  <span className="text-white font-bold">{stats.fps.toFixed(2)}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-[var(--text-secondary)]">Dropped</span>
                  <span className={`font-bold ${stats.dropped_frames > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {stats.dropped_frames}
                  </span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-[var(--text-secondary)]">A/V Sync</span>
                  <span className="text-white font-bold">
                    {stats.av_sync >= 0 ? '+' : ''}{stats.av_sync.toFixed(3)}s
                  </span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-[var(--text-secondary)]">Codec</span>
                  <span className="text-white font-bold">
                    {stats.vformat || 'N/A'}{stats.hwdec ? ` (${stats.hwdec})` : ''}
                  </span>
                </div>
                {stats.playlist_count > 0 && (
                  <div className="flex justify-between gap-8">
                    <span className="text-[var(--text-secondary)]">Playlist</span>
                    <span className="text-[var(--color-pink)] font-bold">
                      {stats.playlist_pos}/{stats.playlist_count}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
