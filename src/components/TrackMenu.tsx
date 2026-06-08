import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Languages, Captions, Plus } from "lucide-react";
import "../App.css";

interface Track {
  id: number;
  kind: string;
  title: string;
  lang: string;
}

export default function TrackMenu({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeAudio, setActiveAudio] = useState<number | string>("auto");
  const [activeSub, setActiveSub] = useState<number | string>("no");

  useEffect(() => {
    const unlisten = listen<Track[]>("tracks-updated", (event) => {
      setTracks(event.payload);
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleAudioSelect = async (id: number | string) => {
    setActiveAudio(id);
    await invoke("set_audio_track", { trackId: id.toString() });
  };

  const handleSubSelect = async (id: number | string) => {
    setActiveSub(id);
    await invoke("set_subtitle_track", { trackId: id.toString() });
  };

  const audioTracks = tracks.filter(t => t.kind === "audio");
  const subTracks = tracks.filter(t => t.kind === "sub");

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
            <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-glow text-[var(--color-pink)] flex items-center gap-2">
              <Languages size={16} /> Languages
            </h2>
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
            
            {/* Audio Tracks */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase border-b border-[rgba(255,255,255,0.1)] pb-2 flex items-center gap-2">
                <Languages size={14} /> Audio
              </h3>
              
              {audioTracks.length === 0 ? (
                <div className="text-[10px] text-[var(--text-secondary)] py-2">No audio tracks found</div>
              ) : (
                audioTracks.map(track => (
                  <div
                    key={`audio-${track.id}`}
                    onClick={() => handleAudioSelect(track.id)}
                    className={`group flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${activeAudio === track.id ? 'bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)]' : 'border-transparent hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]'}`}
                  >
                    <span className={`text-xs font-bold truncate pr-2 ${activeAudio === track.id ? 'text-[var(--color-pink)] text-glow' : 'text-[var(--text-primary)] group-hover:text-[var(--color-pink)]'}`}>
                      {track.title || `Track ${track.id}`}
                    </span>
                    {track.lang && (
                      <span className="text-[9px] text-[var(--text-secondary)] tracking-wider uppercase ml-auto bg-[rgba(0,0,0,0.5)] px-2 py-0.5 rounded">
                        {track.lang}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Subtitle Tracks */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase border-b border-[rgba(255,255,255,0.1)] pb-2 flex items-center gap-2">
                <Captions size={14} /> Subtitles
              </h3>
              
              <div
                onClick={() => handleSubSelect("no")}
                className={`group flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${activeSub === "no" ? 'bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)]' : 'border-transparent hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]'}`}
              >
                <span className={`text-xs font-bold truncate pr-2 ${activeSub === "no" ? 'text-[var(--color-peach)] text-glow' : 'text-[var(--text-primary)] group-hover:text-[var(--color-peach)]'}`}>
                  Off
                </span>
              </div>

              <div
                onClick={async () => {
                  try {
                    const selected = await open({
                      multiple: false,
                      filters: [{
                        name: 'Subtitles',
                        extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub', 'idx']
                      }]
                    });
                    if (selected) {
                      await invoke("load_subtitle", { path: selected as string });
                    }
                  } catch (err) {
                    console.error("Failed to load subtitle:", err);
                  }
                }}
                className="group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors border border-dashed border-[rgba(255,255,255,0.1)] hover:bg-[rgba(254,166,129,0.1)] hover:border-[rgba(254,166,129,0.3)]"
              >
                <Plus size={14} className="text-[var(--color-peach)]" />
                <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--color-peach)] transition-colors">
                  Load External Subtitle
                </span>
              </div>

              {subTracks.length === 0 ? (
                <div className="text-[10px] text-[var(--text-secondary)] py-2">No subtitle tracks found</div>
              ) : (
                subTracks.map(track => (
                  <div
                    key={`sub-${track.id}`}
                    onClick={() => handleSubSelect(track.id)}
                    className={`group flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${activeSub === track.id ? 'bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)]' : 'border-transparent hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]'}`}
                  >
                    <span className={`text-xs font-bold truncate pr-2 ${activeSub === track.id ? 'text-[var(--color-peach)] text-glow' : 'text-[var(--text-primary)] group-hover:text-[var(--color-peach)]'}`}>
                      {track.title || `Track ${track.id}`}
                    </span>
                    {track.lang && (
                      <span className="text-[9px] text-[var(--text-secondary)] tracking-wider uppercase ml-auto bg-[rgba(0,0,0,0.5)] px-2 py-0.5 rounded">
                        {track.lang}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
