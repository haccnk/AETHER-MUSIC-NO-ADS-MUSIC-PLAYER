import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Circle,
  ListPlus,
  MagnifyingGlass,
  Plus,
  X,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { CoverArt } from '../ui/CoverArt';
import { PlaylistCoverMosaic } from '../ui/PlaylistCoverMosaic';
import { cn } from '../../utils/format';

export const AddToPlaylistModal: React.FC = () => {
  const isOpen = usePlayerStore((s) => s.isPlaylistModalOpen);
  const track = usePlayerStore((s) => s.trackToAddToPlaylist);
  const playlists = usePlayerStore((s) => s.playlists);
  const favorites = usePlayerStore((s) => s.favorites);
  const close = usePlayerStore((s) => s.closeAddToPlaylistModal);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const addTrackToPlaylist = usePlayerStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = usePlayerStore((s) => s.removeTrackFromPlaylist);
  const createPlaylist = usePlayerStore((s) => s.createPlaylist);
  const t = usePlayerStore((s) => s.t());

  const [newName, setNewName] = useState('');
  const [filter, setFilter] = useState('');

  const filteredPlaylists = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [playlists, filter]);

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !track) return;
    const created = await createPlaylist(newName.trim());
    if (created) {
      await addTrackToPlaylist(created.id, track, created.name);
    }
    setNewName('');
  };

  const isLiked = track ? favorites.some((f) => f.id === track.id) : false;

  return (
    <AnimatePresence>
      {isOpen && track && (
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
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-surface w-full max-w-md rounded-[24px] bg-[#0E1019]/96 p-5 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ListPlus size={20} className="text-white/80" />
                <h3 className="text-[15.5px] font-bold text-white">{t.album.addToPlaylist}</h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/65 hover:bg-white/15 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
              <CoverArt
                src={track.coverUrl}
                title={track.title}
                artist={track.artist}
                className="h-10 w-10 shrink-0 rounded-lg"
                iconSize={16}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-white">{track.title}</p>
                <p className="truncate text-[12px] text-white/55">{track.artist}</p>
              </div>
            </div>

            {/* Filter input */}
            {playlists.length > 3 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <MagnifyingGlass size={14} className="text-white/45" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t.playlist.filterPlaylists}
                  className="w-full bg-transparent text-[12.5px] text-white placeholder-white/40 outline-none"
                />
              </div>
            )}

            <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {/* Pinned Liked Songs row */}
              <button
                type="button"
                onClick={() => void toggleFavorite(track)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors',
                  isLiked
                    ? 'border-emerald-400/30 bg-emerald-500/10'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.08]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlaylistCoverMosaic
                    variant="liked"
                    title={t.playlist.likedSongsTitle}
                    className="h-9 w-9 shrink-0 rounded-lg"
                    iconSize={16}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-white">
                      {t.playlist.likedSongsTitle}
                    </p>
                    <p className="font-mono text-[11px] text-white/45">
                      {favorites.length} {t.library.tracksUnit}
                    </p>
                  </div>
                </div>
                {isLiked ? (
                  <CheckCircle size={20} weight="fill" className="shrink-0 text-emerald-400" />
                ) : (
                  <Circle size={20} className="shrink-0 text-white/30" />
                )}
              </button>

              {filteredPlaylists.map((pl) => {
                const inPlaylist = pl.tracks.some((tr) => tr.id === track.id);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() =>
                      inPlaylist
                        ? void removeTrackFromPlaylist(pl.id, track.id, pl.name)
                        : void addTrackToPlaylist(pl.id, track, pl.name)
                    }
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors',
                      inPlaylist
                        ? 'border-emerald-400/30 bg-emerald-500/10'
                        : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.08]'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlaylistCoverMosaic
                        title={pl.name}
                        coverUrl={pl.coverUrl}
                        tracks={pl.tracks}
                        className="h-9 w-9 shrink-0 rounded-lg"
                        iconSize={16}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-white">{pl.name}</p>
                        <p className="font-mono text-[11px] text-white/45">
                          {pl.tracks.length} {t.library.tracksUnit}
                        </p>
                      </div>
                    </div>
                    {inPlaylist ? (
                      <CheckCircle size={20} weight="fill" className="shrink-0 text-emerald-400" />
                    ) : (
                      <Circle size={20} className="shrink-0 text-white/30" />
                    )}
                  </button>
                );
              })}
            </div>

            <form onSubmit={(e) => void handleCreateAndAdd(e)} className="mt-4 flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.playlist.namePlaceholder}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[13px] text-white placeholder-white/40 outline-none focus:border-white/30"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black transition-transform active:scale-95 disabled:opacity-45"
              >
                <Plus size={15} weight="bold" />
                {t.playlist.createBtn}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
