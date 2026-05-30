import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { X, ListVideo } from "lucide-react";
import "../App.css";

interface Chapter {
  index: number;
  title: string;
  time: number;
}

export default function ChapterMenu({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    const unlisten = listen<Chapter[]>("chapters-updated", (event) => {
      setChapters(event.payload);
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleChapterClick = async (index: number) => {
    await invoke("set_chapter", { index });
    onClose();
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute top-0 left-0 h-screen w-80 glass-panel border-r border-t-0 border-b-0 border-l-0 z-40 p-6 flex flex-col no-drag-region"
        >
          <div className="flex justify-between items-center mb-8 mt-12">
            <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-glow text-[var(--color-yellow)] flex items-center gap-2">
              <ListVideo size={16} /> Chapters
            </h2>
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {chapters.length === 0 ? (
              <div className="text-xs text-[var(--text-secondary)] tracking-widest text-center mt-10">
                No chapters found in file.
              </div>
            ) : (
              chapters.map((chapter) => (
                <div
                  key={chapter.index}
                  onClick={() => handleChapterClick(chapter.index)}
                  className="group flex justify-between items-center p-3 rounded-lg hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors border border-transparent hover:border-[rgba(255,255,255,0.1)]"
                >
                  <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--color-pink)] transition-colors truncate pr-2">
                    {chapter.title}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] tracking-wider">
                    {formatTime(chapter.time)}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
