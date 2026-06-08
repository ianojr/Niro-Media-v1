import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import "../App.css";

export default function SettingsPanel({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {

  const [videoProfile, setVideoProfile] = useState("standard");
  const [audioProfile, setAudioProfile] = useState("pure");

  const [upscaleMode, setUpscaleMode] = useState("off");
  const [sharpness, setSharpness] = useState(50);
  
  const [hwdec, setHwdec] = useState(true);
  const [deband, setDeband] = useState(false);
  const [interpolation, setInterpolation] = useState(false);

  const [speed, setSpeed] = useState(1.0);
  const [subDelay, setSubDelay] = useState(0.0);
  const [audioDelay, setAudioDelay] = useState(0.0);

  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [panscan, setPanscan] = useState(0.0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (isOpen) onClose();
    }, 5000); // 5 seconds of inactivity closes the panel
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

  const handleVideoProfileChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setVideoProfile(val);
    if (val === "standard") {
      await invoke("set_tone_mapping", { mapping: "hable" });
      handleVideoColor("brightness", 0);
      handleVideoColor("contrast", 0);
      handleVideoColor("saturation", 0);
      handleVideoColor("gamma", 0);
    } else if (val === "cinema") {
      await invoke("set_tone_mapping", { mapping: "bt.2390" });
      await handleVideoColor("brightness", -5);
      await handleVideoColor("contrast", 12);
      await handleVideoColor("saturation", -5);
      await handleVideoColor("gamma", -2);
    } else if (val === "vivid") {
      await invoke("set_tone_mapping", { mapping: "mobius" });
      await handleVideoColor("brightness", 5);
      await handleVideoColor("contrast", 15);
      await handleVideoColor("saturation", 25);
      await handleVideoColor("gamma", 2);
    } else if (val === "anime") {
      await invoke("set_tone_mapping", { mapping: "spline" });
      await handleVideoColor("brightness", 2);
      await handleVideoColor("contrast", 10);
      await handleVideoColor("saturation", 30);
      await handleVideoColor("gamma", 5);
    } else if (val === "night_video") {
      await invoke("set_tone_mapping", { mapping: "hable" });
      await handleVideoColor("brightness", -15);
      await handleVideoColor("contrast", -10);
      await handleVideoColor("saturation", -20);
      await handleVideoColor("gamma", 10);
    }
    showOsd(`Video Profile: ${val.toUpperCase()}`);
    resetTimeout();
  };

  const handleAudioProfileChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAudioProfile(val);
    
    if (val === "pure") {
      await invoke("set_audio_filter", { filterString: "" });
    } else if (val === "home_theatre") {
      await invoke("set_audio_filter", { filterString: "lavfi=[bass=g=6:f=60,surround=level_in=1.5]" });
    } else if (val === "night") {
      await invoke("set_audio_filter", { filterString: "lavfi=[acompressor=ratio=4:attack=5:release=50:makeup=2]" });
    } else if (val === "dialogue") {
      await invoke("set_audio_filter", { filterString: "lavfi=[equalizer=f=1000:width_type=h:width=500:g=6,equalizer=f=3000:width_type=h:width=500:g=4,bass=g=-4:f=100]" });
    } else if (val === "audiophile") {
      await invoke("set_audio_filter", { filterString: "lavfi=[extrastereo=m=1.2]" });
    } else if (val === "bass_boost") {
      await invoke("set_audio_filter", { filterString: "lavfi=[bass=g=12:f=50:w=0.5]" });
    }
    showOsd(`Audio Profile: ${val.replace('_', ' ').toUpperCase()}`);
    resetTimeout();
  };

  const showOsd = (message: string) => {
    window.dispatchEvent(new CustomEvent('show-osd', { detail: message }));
  };

  const handleSpeed = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSpeed(val);
    await invoke("set_speed", { speed: val });
    showOsd(`Speed: ${val}x`);
  };

  const handleSubDelay = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSubDelay(val);
    await invoke("set_subtitle_delay", { delay: val });
    showOsd(`Sub Delay: ${val > 0 ? '+' : ''}${val.toFixed(2)}s`);
  };

  const handleAudioDelay = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAudioDelay(val);
    await invoke("set_audio_delay", { delay: val });
    showOsd(`Audio Delay: ${val > 0 ? '+' : ''}${val.toFixed(2)}s`);
  };

  const handleVideoColor = async (prop: string, val: number) => {
    if (prop === "brightness") setBrightness(val);
    else if (prop === "contrast") setContrast(val);
    else if (prop === "saturation") setSaturation(val);
    await invoke("set_video_color", { property: prop, value: val });
    showOsd(`${prop.charAt(0).toUpperCase() + prop.slice(1)}: ${val}`);
  };

  const handlePanscan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPanscan(val);
    await invoke("set_panscan", { value: val });
    showOsd(`Zoom: ${Math.round(val * 100)}%`);
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
          <div className="flex justify-between items-center mb-8 mt-12">
            <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-glow text-[var(--color-yellow)]">Advanced Settings</h2>
            <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* GPU Upscaling */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-[var(--color-pink)] uppercase border-b border-[rgba(255,255,255,0.1)] pb-2 flex items-center gap-2">
                <Sparkles size={12} /> GPU Upscaling
              </h3>

              <div className="flex gap-2">
                {[
                  { label: "Off", value: "off" },
                  { label: "FSR 1.0", value: "fsr" },
                  { label: "Anime4K", value: "anime4k" },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={async () => {
                      setUpscaleMode(mode.value);
                      await invoke("set_upscale_mode", { mode: mode.value });
                      showOsd(`Upscaling: ${mode.label}`);
                      resetTimeout();
                    }}
                    className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer border ${
                      upscaleMode === mode.value
                        ? "bg-[rgba(254,129,212,0.15)] border-[rgba(254,129,212,0.3)] text-[var(--color-pink)] shadow-[0_0_12px_rgba(254,129,212,0.2)] text-glow"
                        : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.1)]"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {upscaleMode === "fsr" && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                    <span>Sharpness</span>
                    <span className="text-[var(--color-pink)] text-glow">{sharpness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="100" step="1"
                    value={sharpness}
                    onChange={async (e) => {
                      const val = parseInt(e.target.value);
                      setSharpness(val);
                      await invoke("set_upscale_sharpness", { value: val / 100 });
                      showOsd(`Sharpness: ${val}%`);
                      resetTimeout();
                    }}
                    className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-[var(--color-pink)]"
                  />
                </div>
              )}
            </div>

            {/* Presets */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-[var(--color-yellow)] uppercase border-b border-[rgba(255,255,255,0.1)] pb-2 flex items-center gap-2">
                 Profiles & Presets
              </h3>
              
              <div className="flex justify-between items-center text-xs text-[var(--text-primary)]">
                <span>Video Profile</span>
                <select 
                  value={videoProfile}
                  onChange={handleVideoProfileChange}
                  className="bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 outline-none text-[10px] uppercase cursor-pointer"
                >
                  <option value="standard">Standard / Accurate</option>
                  <option value="cinema">Theatre / Cinema</option>
                  <option value="vivid">Vivid / Dynamic</option>
                  <option value="anime">Anime / Animation</option>
                  <option value="night_video">Eye Comfort / Night</option>
                </select>
              </div>

              <div className="flex justify-between items-center text-xs text-[var(--text-primary)]">
                <span>Audio Profile</span>
                <select 
                  value={audioProfile}
                  onChange={handleAudioProfileChange}
                  className="bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 outline-none text-[10px] uppercase cursor-pointer"
                >
                  <option value="pure">Pure Direct / Studio</option>
                  <option value="home_theatre">Home Theatre (Surround & Bass)</option>
                  <option value="night">Night Mode (Compression)</option>
                  <option value="dialogue">Clear Dialogue</option>
                  <option value="audiophile">Audiophile (Wide Stereo)</option>
                  <option value="bass_boost">Heavy Bass Boost</option>
                </select>
              </div>
            </div>

            {/* Video Processing */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase border-b border-[rgba(255,255,255,0.1)] pb-2">Video Engine</h3>

              {/* Hardware Decoding */}
              <div 
                className="group flex justify-between items-center cursor-pointer bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] p-3 rounded-xl border border-[rgba(255,255,255,0.05)] transition-all"
                onClick={async () => {
                  const next = !hwdec;
                  setHwdec(next);
                  await invoke("set_property_string", { name: "hwdec", value: next ? "auto" : "no" });
                }}
              >
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${hwdec ? 'text-white text-glow' : 'text-[var(--text-primary)]'}`}>Hardware Decoding</span>
                  <span className="text-[9px] text-[var(--text-secondary)]">GPU Acceleration</span>
                </div>
                <div className={`w-8 h-4 rounded-full transition-colors relative ${hwdec ? 'bg-[var(--color-peach)]' : 'bg-[rgba(255,255,255,0.2)]'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all transform ${hwdec ? 'left-4' : 'left-0.5'}`} />
                </div>
              </div>

              {/* Debanding */}
              <div 
                className="group flex justify-between items-center cursor-pointer bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] p-3 rounded-xl border border-[rgba(255,255,255,0.05)] transition-all"
                onClick={async () => {
                  const next = !deband;
                  setDeband(next);
                  await invoke("set_property_string", { name: "deband", value: next ? "yes" : "no" });
                }}
              >
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${deband ? 'text-white text-glow' : 'text-[var(--text-primary)]'}`}>Debanding</span>
                  <span className="text-[9px] text-[var(--text-secondary)]">Remove color gradients banding</span>
                </div>
                <div className={`w-8 h-4 rounded-full transition-colors relative ${deband ? 'bg-[var(--color-peach)]' : 'bg-[rgba(255,255,255,0.2)]'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all transform ${deband ? 'left-4' : 'left-0.5'}`} />
                </div>
              </div>

              {/* Interpolation */}
              <div 
                className="group flex justify-between items-center cursor-pointer bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] p-3 rounded-xl border border-[rgba(255,255,255,0.05)] transition-all"
                onClick={async () => {
                  const next = !interpolation;
                  setInterpolation(next);
                  await invoke("set_property_string", { name: "interpolation", value: next ? "yes" : "no" });
                }}
              >
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${interpolation ? 'text-white text-glow' : 'text-[var(--text-primary)]'}`}>Smooth Motion</span>
                  <span className="text-[9px] text-[var(--text-secondary)]">Display sync interpolation</span>
                </div>
                <div className={`w-8 h-4 rounded-full transition-colors relative ${interpolation ? 'bg-[var(--color-peach)]' : 'bg-[rgba(255,255,255,0.2)]'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all transform ${interpolation ? 'left-4' : 'left-0.5'}`} />
                </div>
              </div>

              {/* Zoom (Panscan) */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                  <span>Zoom (Crop)</span>
                  <span className="text-[var(--text-primary)] text-glow">{Math.round(panscan * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={panscan} onChange={handlePanscan}
                  className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Color Adjustments */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                  <span>Brightness</span>
                  <span className="text-[var(--text-primary)] text-glow">{brightness}</span>
                </div>
                <input 
                  type="range" 
                  min="-100" max="100" step="1" 
                  value={brightness} onChange={(e) => handleVideoColor("brightness", parseInt(e.target.value))}
                  className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                  <span>Contrast</span>
                  <span className="text-[var(--text-primary)] text-glow">{contrast}</span>
                </div>
                <input 
                  type="range" 
                  min="-100" max="100" step="1" 
                  value={contrast} onChange={(e) => handleVideoColor("contrast", parseInt(e.target.value))}
                  className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="flex flex-col gap-2 pb-2">
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                  <span>Saturation</span>
                  <span className="text-[var(--text-primary)] text-glow">{saturation}</span>
                </div>
                <input 
                  type="range" 
                  min="-100" max="100" step="1" 
                  value={saturation} onChange={(e) => handleVideoColor("saturation", parseInt(e.target.value))}
                  className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

            </div>

            {/* Playback Controls */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-[var(--color-yellow)] uppercase border-b border-[rgba(255,255,255,0.1)] pb-2">
                Playback Speed
              </h3>
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                  <span>0.25x</span>
                  <span className="text-[var(--color-yellow)] text-glow">{speed.toFixed(2)}x</span>
                  <span>4.00x</span>
                </div>
                <input 
                  type="range" 
                  min="0.25" max="4.0" step="0.05" 
                  value={speed} onChange={handleSpeed}
                  className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-[var(--color-yellow)]"
                />
              </div>
            </div>

            {/* Sync Controls */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-[var(--color-peach)] uppercase border-b border-[rgba(255,255,255,0.1)] pb-2">
                Timing & Sync
              </h3>
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                  <span>Audio Delay</span>
                  <span className="text-[var(--color-peach)] text-glow">{audioDelay > 0 ? '+' : ''}{audioDelay.toFixed(2)}s</span>
                </div>
                <input 
                  type="range" 
                  min="-5.0" max="5.0" step="0.05" 
                  value={audioDelay} onChange={handleAudioDelay}
                  className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-[var(--color-peach)]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                  <span>Subtitle Delay</span>
                  <span className="text-[var(--color-peach)] text-glow">{subDelay > 0 ? '+' : ''}{subDelay.toFixed(2)}s</span>
                </div>
                <input 
                  type="range" 
                  min="-5.0" max="5.0" step="0.05" 
                  value={subDelay} onChange={handleSubDelay}
                  className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-lg appearance-none cursor-pointer accent-[var(--color-peach)]"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
