import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkle } from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const ToastHost: React.FC = () => {
  const message = usePlayerStore((s) => s.toastMessage);

  return (
    <div className="pointer-events-none fixed top-16 left-0 right-0 z-50 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: -14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="flex items-center gap-2 rounded-full border border-white/18 bg-[#0E111A]/90 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_14px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <Sparkle size={14} weight="fill" className="text-cyan-300" />
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
