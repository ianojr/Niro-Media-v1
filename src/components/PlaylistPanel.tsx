import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, Plus, X, Trash2, Play } from "lucide-react";
import "../App.css";

interface PlaylistItem {
  index: number;
  filename: string;
  current: boolean;
}

export default function PlaylistPanel({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (isOpen) onClose();
    }, 5000);
  };

  useEffect(() => {
    if (isOpen) {
      resetTimeout();
      window.addEventListener("mousemove", resetTimeout);
      window.addEventListener("keydown", resetTimeout);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    return () => {
      window.removeEventListener("mousemove", resetTimeout);
      window.removeEventListener("keydown", resetTimeout);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    const unlisten = listen<PlaylistItem[]>("playlist-updated", (event) => {
      setItems(event.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const showOsd = (message: string) => {
    window.dispatchEvent(new CustomEvent("show-osd", { detail: message }));
  };

  const handlePlayIndex = async (index: number) => {
    try {
      await invoke("playlist_play_index", { index });
      showOsd(`Playing Track ${index + 1}`);
    } catch (e) {
      console.error("Failed to play track:", e);
    }
    resetTimeout();
  };

  const handleRemove = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("playlist_remove", { index });
      showOsd("Track Removed");
    } catch (err) {
      console.error("Failed to remove track:", err);
    }
    resetTimeout();
  };

  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: "Media",
          extensions: ["mp4", "mkv", "webm", "mov", "avi", "mp3", "flac", "mka", "wav", "ogg", "aac"]
        }]
      });
      if (selected && Array.isArray(selected) && selected.length > 0) {
        await invoke("playlist_append_multiple", { paths: selected });
        showOsd(`Added ${selected.length} file${selected.length > 1 ? "s" : ""}`);
      }
    } catch (err) {
      console.error("Failed to add files:", err);
    }
    resetTimeout();
  };

  const handleClearAll = async () => {
    try {
      await invoke("playlist_clear");
      setItems([]);
      showOsd("Playlist Cleared");
    } catch (err) {
      console.error("Failed to clear playlist:", err);
    }
    resetTimeout();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute top-0 right-0 h-screen w-80 glass-panel border-l border-t-0 border-b-0 border-r-0 z-[60] p-6 flex flex-col no-drag-region"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 mt-12">
            <div className="flex items-center gap-2">
              <ListMusic size={16} className="text-[var(--color-pink)]" />
              <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-glow text-[var(--color-pink)]">
                Playlist
              </h2>
            </div>
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>

          {/* Track Count */}
          <div className="text-[10px] font-bold tracking-[0.15em] text-[var(--text-secondary)] uppercase mb-4">
            {items.length} {items.length === 1 ? "track" : "tracks"}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleAddFiles}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(254,129,212,0.15)] hover:border-[rgba(254,129,212,0.3)] text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer text-[var(--text-secondary)] hover:text-[var(--color-pink)]"
            >
              <Plus size={14} />
              Add Files
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,80,80,0.15)] hover:border-[rgba(255,80,80,0.3)] text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer text-[var(--text-secondary)] hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Track List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-40">
                <ListMusic size={48} strokeWidth={1} className="mb-4 text-[var(--text-secondary)]" />
                <p className="text-xs text-[var(--text-secondary)] tracking-widest uppercase">No Tracks</p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">Add files or drag & drop</p>
              </div>
            ) : (
              items.map((item) => (
                <motion.div
                  key={`${item.index}-${item.filename}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: item.index * 0.02 }}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                    item.current
                      ? "bg-[rgba(254,129,212,0.15)] border border-[rgba(254,129,212,0.3)] shadow-[0_0_15px_rgba(254,129,212,0.15)]"
                      : "bg-[rgba(255,255,255,0.02)] border border-transparent hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.05)]"
                  }`}
                  onClick={() => handlePlayIndex(item.index)}
                >
                  {/* Track Number / Play Icon */}
                  <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                    {item.current ? (
                      <Play size={12} className="text-[var(--color-pink)] fill-[var(--color-pink)]" />
                    ) : (
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] group-hover:hidden">
                        {item.index + 1}
                      </span>
                    )}
                    {!item.current && (
                      <Play size={12} className="text-[var(--text-secondary)] hidden group-hover:block" />
                    )}
                  </div>

                  {/* Filename */}
                  <span
                    className={`flex-1 text-xs truncate ${
                      item.current
                        ? "text-[var(--color-pink)] font-bold text-glow"
                        : "text-[var(--text-primary)] font-medium"
                    }`}
                    title={item.filename}
                  >
                    {item.filename}
                  </span>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => handleRemove(item.index, e)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[rgba(255,80,80,0.2)] text-[var(--text-secondary)] hover:text-red-400 transition-all cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
