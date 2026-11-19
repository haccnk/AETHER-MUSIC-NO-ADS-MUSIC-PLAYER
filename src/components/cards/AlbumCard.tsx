import React, { useState } from 'react';
import { DownloadSimple, Play, SpinnerGap } from '@phosphor-icons/react';
import { Album } from '../../types/music';
import { usePlayerStore } from '../../store/usePlayerStore';
import { CoverArt } from '../ui/CoverArt';

interface AlbumCardProps {
  album: Album;
  onOpen: (album: Album) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onOpen }) => {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueDownloads = usePlayerStore((s) => s.enqueueDownloads);
  const setView = usePlayerStore((s) => s.setView);
  const t = usePlayerStore((s) => s.t());
  const [busyAction, setBusyAction] = useState<'play' | 'dl' | null>(null);

  const handleQuickAction = async (
    e: React.MouseEvent,
    action: 'play' | 'dl'
  ): Promise<void> => {
    e.stopPropagation();
    setBusyAction(action);
    try {
      const tracks =
        album.tracks && album.tracks.length > 0
          ? album.tracks
          : (await window.aetherAPI.getAlbumDetails(album.id))?.tracks ?? [];
      if (tracks.length === 0) return;

      if (action === 'play') {
        await playTrack(tracks[0], tracks);
      } else {
        await enqueueDownloads(tracks, album.title);
        setView('downloads');
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      onClick={() => onOpen(album)}
      className="group cursor-pointer rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-3 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.06] hover:shadow-[0_22px_45px_-20px_rgba(0,0,0,0.8)]"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[16px] ring-1 ring-white/10">
        <CoverArt
          src={album.coverUrl}
          title={album.title}
          artist={album.artist}
          className="h-full w-full"
          imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
          iconSize={40}
        />

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-2 opacity-0 translate-y-2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:opacity-100 group-hover:translate-y-0">
          <button
            type="button"
            onClick={(e) => void handleQuickAction(e, 'dl')}
            title={t.discover.downloadAlbum}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white/95 backdrop-blur-md transition-transform duration-200 hover:scale-105 hover:bg-white/20 active:scale-95"
          >
            {busyAction === 'dl' ? (
              <SpinnerGap size={16} className="animate-spin" />
            ) : (
              <DownloadSimple size={16} weight="bold" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => void handleQuickAction(e, 'play')}
            title={t.discover.playNow}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            {busyAction === 'play' ? (
              <SpinnerGap size={18} className="animate-spin" />
            ) : (
              <Play size={18} weight="fill" className="ml-0.5" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 px-0.5">
        <h3 className="truncate text-[14px] font-semibold tracking-tight text-white/95">
          {album.title}
        </h3>
        <p className="mt-0.5 truncate text-[12.5px] text-white/55">
          {album.artist}
          {album.year ? ` • ${album.year}` : ''}
        </p>
      </div>
    </div>
  );
};
