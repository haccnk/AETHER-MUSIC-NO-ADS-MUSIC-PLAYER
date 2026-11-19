import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowBendRightUp,
  DownloadSimple,
  Heart,
  ListPlus,
  Play,
  Queue,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { CoverArt } from './CoverArt';
import { cn } from '../../utils/format';

export const TrackContextMenu: React.FC = () => {
  const menu = usePlayerStore((s) => s.contextMenu);
  const close = usePlayerStore((s) => s.closeTrackContextMenu);
  const favorites = usePlayerStore((s) => s.favorites);
  const downloadedTracks = usePlayerStore((s) => s.downloadedTracks);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const playNextInQueue = usePlayerStore((s) => s.playNextInQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const openAddToPlaylistModal = usePlayerStore((s) => s.openAddToPlaylistModal);
  const enqueueDownloads = usePlayerStore((s) => s.enqueueDownloads);
  const t = usePlayerStore((s) => s.t());

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, close]);

  if (!menu) return null;

  const { track, queueContext } = menu;
  const isFav = favorites.some((f) => f.id === track.id);
  const isOffline = Boolean(track.localPath || downloadedTracks[track.id]?.localPath);

  // Clamp coordinates so menu stays comfortably inside viewport
  const menuW = 248;
  const menuH = 290;
  const left = Math.min(menu.x, window.innerWidth - menuW - 14);
  const top = Math.min(menu.y, window.innerHeight - menuH - 14);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        style={{ left: Math.max(10, left), top: Math.max(10, top), width: menuW }}
        className="fixed z-50 overflow-hidden rounded-[18px] border border-white/15 bg-[#0D1018]/96 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
      >
        <div className="mb-1 flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-2.5 py-2">
          <CoverArt
            src={track.coverUrl}
            title={track.title}
            artist={track.artist}
            className="h-9 w-9 shrink-0 rounded-lg"
            iconSize={15}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{track.title}</p>
            <p className="truncate text-[11px] text-white/55">{track.artist}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void playTrack(track, queueContext);
            close();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-white/90 hover:bg-white/10"
        >
          <Play size={15} weight="fill" />
          {t.discover.playNow}
        </button>

        <button
          type="button"
          onClick={() => {
            playNextInQueue(track);
            close();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-white/90 hover:bg-white/10"
        >
          <ArrowBendRightUp size={15} />
          {t.album.playNext}
        </button>

        <button
          type="button"
          onClick={() => {
            addToQueue(track);
            close();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-white/90 hover:bg-white/10"
        >
          <Queue size={15} />
          {t.album.addToQueue}
        </button>

        <div className="my-1 h-px bg-white/[0.08]" />

        <button
          type="button"
          onClick={() => {
            void toggleFavorite(track);
            close();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-white/90 hover:bg-white/10"
        >
          <Heart
            size={15}
            weight={isFav ? 'fill' : 'regular'}
            className={cn(isFav ? 'text-rose-400' : 'text-white/80')}
          />
          {isFav ? t.playlist.likedToggleRemove : t.playlist.likedToggleAdd}
        </button>

        <button
          type="button"
          onClick={() => {
            close();
            openAddToPlaylistModal(track);
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-white/90 hover:bg-white/10"
        >
          <ListPlus size={15} />
          {t.album.addToPlaylist}
        </button>

        {!isOffline && (
          <button
            type="button"
            onClick={() => {
              void enqueueDownloads([track], track.album);
              close();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-cyan-200 hover:bg-cyan-400/15"
          >
            <DownloadSimple size={15} />
            {t.album.downloadTrack}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
