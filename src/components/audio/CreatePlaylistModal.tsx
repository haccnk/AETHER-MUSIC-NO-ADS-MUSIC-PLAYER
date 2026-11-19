import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicNotesPlus, X } from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const CreatePlaylistModal: React.FC = () => {
  const isOpen = usePlayerStore((s) => s.isCreatePlaylistModalOpen);
  const editingPlaylist = usePlayerStore((s) => s.editingPlaylist);
  const close = usePlayerStore((s) => s.closeCreatePlaylistModal);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const updatePlaylist = usePlayerStore((s) => s.updatePlaylist);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const t = usePlayerStore((s) => s.t());

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(editingPlaylist?.name ?? '');
      setDescription(editingPlaylist?.description ?? '');
    }
  }, [isOpen, editingPlaylist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingPlaylist) {
      await updatePlaylist(editingPlaylist.id, {
        name: name.trim(),
        description: description.trim(),
      });
    } else {
      const created = await createPlaylist(name.trim(), description.trim());
      if (created) openPlaylist(created.id);
    }
    close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-surface w-full max-w-md rounded-[24px] bg-[#0E1019]/96 p-6 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                  <MusicNotesPlus size={19} weight="light" />
                </div>
                <h3 className="text-[16px] font-bold text-white">
                  {editingPlaylist ? t.playlist.editTitle : t.playlist.createTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/65 hover:bg-white/15 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-3.5">
              <div>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.playlist.namePlaceholder}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[14px] text-white placeholder-white/40 outline-none focus:border-white/35"
                />
              </div>

              <div>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.playlist.descPlaceholder}
                  className="w-full resize-none rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-[13px] text-white placeholder-white/35 outline-none focus:border-white/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-[13px] font-medium text-white/75 hover:bg-white/10"
                >
                  {t.playlist.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="rounded-full bg-white px-5 py-2 text-[13px] font-bold text-black transition-transform active:scale-95 disabled:opacity-40"
                >
                  {editingPlaylist ? t.playlist.saveBtn : t.playlist.createBtn}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
