import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { QueueEditorList } from '../audio/QueueEditorList';

export const QueueDrawer: React.FC = () => {
  const isOpen = usePlayerStore((s) => s.isQueueOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const t = usePlayerStore((s) => s.t());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ opacity: 0, x: 320 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 320 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="fixed bottom-28 right-4 top-16 z-20 flex w-[350px] flex-col overflow-hidden rounded-[24px] border border-white/14 bg-[#0B0D14]/92 shadow-2xl backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
            <h3 className="text-[15px] font-bold text-white">{t.queue.title}</h3>
            <button
              type="button"
              onClick={() => setQueueOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/65 hover:bg-white/15 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <QueueEditorList />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
