import React from 'react';
import {
  ArrowBendRightUp,
  CheckCircle,
  DotsThree,
  DownloadSimple,
  Heart,
  Play,
  Plus,
  SpinnerGap,
} from '@phosphor-icons/react';
import { Track } from '../../types/music';
import { usePlayerStore } from '../../store/usePlayerStore';
import { cn, formatDuration } from '../../utils/format';
import { CoverArt } from '../ui/CoverArt';

interface TrackRowProps {
  track: Track;
  index: number;
  queueContext?: Track[];
  contextName?: string;
  showCover?: boolean;
  showAlbum?: boolean;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  queueContext,
  contextName,
  showCover = true,
  showAlbum = true,
}) => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoadingStream = usePlayerStore((s) => s.isLoadingStream);
  const favorites = usePlayerStore((s) => s.favorites);
  const downloadedTracks = usePlayerStore((s) => s.downloadedTracks);
  const downloads = usePlayerStore((s) => s.downloads);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const enqueueDownloads = usePlayerStore((s) => s.enqueueDownloads);
  const playNextInQueue = usePlayerStore((s) => s.playNextInQueue);
  const openAddToPlaylistModal = usePlayerStore((s) => s.openAddToPlaylistModal);
  const openTrackContextMenu = usePlayerStore((s) => s.openTrackContextMenu);
  const t = usePlayerStore((s) => s.t());

  const isActive = currentTrack?.id === track.id;
  const isFav = favorites.some((f) => f.id === track.id);
  const isOffline = Boolean(track.localPath || downloadedTracks[track.id]?.localPath);
  const activeTask = downloads.find(
    (d) =>
      d.track.id === track.id &&
      (d.status === 'queued' ||
        d.status === 'resolving' ||
        d.status === 'downloading' ||
        d.status === 'tagging')
  );

  const handlePlay = () => {
    if (isActive) {
      void togglePlayPause();
    } else {
      void playTrack(track, queueContext, { contextName });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openTrackContextMenu(e.clientX, e.clientY, track, queueContext);
  };

  return (
    <div
      onDoubleClick={handlePlay}
      onContextMenu={handleContextMenu}
      className={cn(
        'group flex items-center gap-2.5 rounded-[14px] px-2.5 py-2 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
        isActive
          ? 'bg-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
          : 'hover:bg-white/[0.06]'
      )}
    >
      {/* Index / Play button */}
      <button
        type="button"
        onClick={handlePlay}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:text-white"
      >
        {isActive && isLoadingStream ? (
          <SpinnerGap size={15} className="animate-spin text-white" />
        ) : isActive && isPlaying ? (
          <div className="flex items-end gap-[2.5px] h-3.5">
            <span className="w-[2.5px] rounded-full bg-white animate-[pulse_0.8s_ease-in-out_infinite] h-3" />
            <span className="w-[2.5px] rounded-full bg-white animate-[pulse_0.6s_ease-in-out_infinite_0.2s] h-2" />
            <span className="w-[2.5px] rounded-full bg-white animate-[pulse_0.9s_ease-in-out_infinite_0.4s] h-3.5" />
          </div>
        ) : (
          <>
            <span className="font-mono text-[12px] tabular-nums group-hover:hidden">
              {String(track.trackNumber ?? index + 1).padStart(2, '0')}
            </span>
            <Play size={15} weight="fill" className="hidden text-white group-hover:block" />
          </>
        )}
      </button>

      {/* Cover + Title + Artist */}
      <div className="flex min-w-[110px] flex-1 items-center gap-3 cursor-pointer" onClick={handlePlay}>
        {showCover && (
          <CoverArt
            src={track.coverUrl}
            title={track.title}
            artist={track.artist}
            className="h-10 w-10 shrink-0 rounded-[10px] ring-1 ring-white/10"
            iconSize={18}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'truncate text-[13.5px] font-medium',
                isActive ? 'text-white font-semibold' : 'text-white/92'
              )}
            >
              {track.title}
            </p>
            {isOffline && (
              <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-emerald-300">
                {track.bitrate ? `${track.bitrate}k` : 'OFFLINE'}
              </span>
            )}
            {!isOffline && track.sourceType === 'spotify' && (
              <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-300">
                SPOTIFY
              </span>
            )}
          </div>
          <p className="truncate text-[12px] text-white/55">{track.artist}</p>
        </div>
      </div>

      {/* Album Column */}
      {showAlbum && (
        <div className="hidden md:block w-[22%] min-w-0">
          <p className="truncate text-[13px] text-white/50">{track.album}</p>
        </div>
      )}

      {/* Actions (compact at rest so narrow rows never crush titles; reveal full actions on hover) */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => void toggleFavorite(track)}
          title={isFav ? t.playlist.likedToggleRemove : t.playlist.likedToggleAdd}
          className={cn(
            'h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-90',
            isFav ? 'flex text-rose-400' : 'hidden group-hover:flex text-white/45 hover:text-white'
          )}
        >
          <Heart size={15} weight={isFav ? 'fill' : 'regular'} />
        </button>

        <button
          type="button"
          onClick={() => playNextInQueue(track)}
          title={t.album.playNext}
          className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowBendRightUp size={14} />
        </button>

        <button
          type="button"
          onClick={() => openAddToPlaylistModal(track)}
          title={t.album.addToPlaylist}
          className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus size={15} weight="regular" />
        </button>

        {activeTask ? (
          <div className="flex h-7 w-10 items-center justify-center font-mono text-[10.5px] text-cyan-300 tabular-nums">
            {activeTask.progress}%
          </div>
        ) : isOffline ? (
          <div
            title={t.album.offlineBadge}
            className="flex h-7 w-7 items-center justify-center text-emerald-400"
          >
            <CheckCircle size={15} weight="fill" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void enqueueDownloads([track], track.album)}
            title={t.album.downloadTrack}
            className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <DownloadSimple size={15} weight="regular" />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            openTrackContextMenu(rect.right - 220, rect.bottom + 6, track, queueContext);
          }}
          className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <DotsThree size={17} weight="bold" />
        </button>
      </div>

      {/* Duration */}
      <span className="w-10 shrink-0 text-right font-mono text-[11.5px] text-white/50 tabular-nums">
        {formatDuration(track.duration)}
      </span>
    </div>
  );
};
