import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import "../App.css";

export default function CorruptModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unlisten = listen("file-corrupt-warning", () => {
      setIsOpen(true);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm no-drag-region"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-md border border-red-500/30 bg-[rgba(20,0,0,0.8)] backdrop-blur-xl rounded-3xl p-8 shadow-[0_0_50px_rgba(255,0,0,0.15)] relative overflow-hidden"
          >
            {/* Animated red glow background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/20 rounded-full blur-[50px] pointer-events-none" />

            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 text-red-300/50 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              
              <h2 className="text-xl font-bold tracking-widest text-white uppercase">File Corruption Detected</h2>
              
              <p className="text-sm text-red-200/70 leading-relaxed font-light">
                The hardware decoder has encountered severe stream errors, indicating this file is heavily corrupted or truncated. 
                <br/><br/>
                Playback has been automatically paused to prevent visual tearing and GPU artifacting.
              </p>

              <button
                onClick={() => setIsOpen(false)}
                className="mt-6 w-full py-3 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-white text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,0,0,0.2)] hover:shadow-[0_0_30px_rgba(255,0,0,0.4)] cursor-pointer"
              >
                Dismiss & Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
