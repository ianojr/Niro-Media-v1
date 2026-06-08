import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, Radio, Waves, BarChart2 } from "lucide-react";
import "../App.css";

interface VisualizerMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const VISUALIZERS = [
  {
    id: "spectrogram",
    name: "CQT Spectrogram",
    icon: <Activity size={16} />,
    description: "Piano-roll frequency waterfall",
    lavfi: "[aid1]asplit[ao][a]; [a]showcqt=s=1920x1080:fps=60:bar_h=200:axis_h=0:sono_h=0:bar_v=11:bar_g=2[vo]"
  },
  {
    id: "neon_waves",
    name: "Neon Waves",
    icon: <Waves size={16} />,
    description: "Mirrored glowing waveforms",
    lavfi: "[aid1]asplit[ao][a]; [a]showwaves=s=1920x1080:mode=cline:colors=Magenta|Yellow[vo]"
  },
  {
    id: "vectorscope",
    name: "Lissajous Matrix",
    icon: <Radio size={16} />,
    description: "Sweeping geometric phase curves",
    lavfi: "[aid1]asplit[ao][a]; [a]avectorscope=s=1920x1080:m=lissajous_xy:draw=line[vo]"
  },
  {
    id: "histogram",
    name: "Data Bar Histogram",
    icon: <BarChart2 size={16} />,
    description: "Scrolling frequency data bars",
    lavfi: "[aid1]asplit[ao][a]; [a]ahistogram=s=1920x1080:slide=scroll:scale=log:dmode=separate[vo]"
  }
];

export default function VisualizerMenu({ isOpen, onClose }: VisualizerMenuProps) {
  const [activeVis, setActiveVis] = useState("spectrogram");

  const handleSelect = async (id: string, lavfi: string) => {
    setActiveVis(id);
    try {
      await invoke("set_property_string", { name: "lavfi-complex", value: lavfi });
    } catch (err) {
      console.error("Failed to set visualizer:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed left-0 top-12 bottom-24 w-80 glass-panel border-l-0 border-y-[1px] border-r-[1px] z-40 overflow-hidden cyber-grid flex flex-col"
        >
          <div className="p-6 border-b border-[var(--theme-border)] flex items-center justify-between bg-black/40">
            <div>
              <h2 className="text-xl text-[var(--color-yellow)] tracking-[0.2em] font-display">Visualizers</h2>
              <p className="text-[10px] text-[var(--text-secondary)] tracking-widest uppercase mt-1">Real-time Audio Engine</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              <X size={18} className="text-[var(--text-secondary)] hover:text-white" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-2">
            {VISUALIZERS.map(vis => (
              <div
                key={vis.id}
                onClick={() => handleSelect(vis.id, vis.lavfi)}
                className={`group flex flex-col p-4 cursor-pointer transition-all border ${
                  activeVis === vis.id 
                    ? 'bg-[rgba(254,129,212,0.15)] border-[var(--color-pink)]' 
                    : 'bg-black/20 border-transparent hover:border-[var(--color-pink)] hover:bg-[rgba(254,129,212,0.05)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${activeVis === vis.id ? 'text-[var(--color-pink)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--color-pink)]'}`}>
                    {vis.icon}
                  </div>
                  <span className={`text-sm font-display tracking-wider ${activeVis === vis.id ? 'text-[var(--color-pink)] text-glow' : 'text-[var(--text-primary)]'}`}>
                    {vis.name}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-2 pl-7 font-mono opacity-60">
                  {vis.description}
                </div>
              </div>
            ))}
            
            <div className="mt-8 p-4 border border-[var(--theme-border)] bg-black/40 text-xs text-[var(--text-secondary)] leading-relaxed font-mono">
              <span className="text-[var(--color-peach)] block mb-2 font-display">INFO</span>
              Visualizers utilize the native FFmpeg lavfi pipeline for zero-latency, GPU-accelerated rendering. They only activate when playing audio files without a video track.
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
