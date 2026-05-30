import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function OSD() {
  const [message, setMessage] = useState("");
  const [isVisible, setIsVisible] = useState(false);

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

    window.addEventListener("show-osd", handleShowOsd);
    return () => window.removeEventListener("show-osd", handleShowOsd);
  }, []);

  return (
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
  );
}
