import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import "../App.css";

interface Telemetry {
  hwdec: string;
  vformat: string;
  sig_peak: number;
}

export default function HardwareBadge() {
  const [hwdec, setHwdec] = useState<string>("");
  const [vformat, setVformat] = useState<string>("");

  useEffect(() => {
    const unlisten = listen<Telemetry>("time-update", (event) => {
      setHwdec(event.payload.hwdec !== "Unknown" ? event.payload.hwdec : "");
      setVformat(event.payload.vformat !== "Unknown" ? event.payload.vformat : "");
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  if (!hwdec || !vformat) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="absolute top-6 right-6 z-40 glass-panel px-4 py-2 rounded-full flex items-center gap-3 no-drag-region cursor-default pointer-events-none"
      >
        <div className="w-2 h-2 rounded-full bg-[var(--color-pink)] shadow-[0_0_8px_var(--color-pink)] animate-pulse" />
        <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase">
          {vformat} &bull; <span className="text-[var(--text-primary)] text-glow">{hwdec}</span>
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
