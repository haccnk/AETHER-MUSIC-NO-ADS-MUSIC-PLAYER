import React, { useMemo, useState } from 'react';
import { Reorder } from 'framer-motion';
import {
  DotsSixVertical,
  DownloadSimple,
  MagnifyingGlass,
  MusicNotes,
  PencilSimple,
  Play,
  Shuffle,
  Trash,
} from '@phosphor-icons/react';
import { Track } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';
import { TrackRow } from '../components/cards/TrackRow';
import { PlaylistCoverMosaic } from '../components/ui/PlaylistCoverMosaic';
import { formatTotalAlbumDuration } from '../utils/format';

interface CollectionViewProps {
  mode: 'favorites' | 'playlist';
}

export const CollectionView: React.FC<CollectionViewProps> = ({ mode }) => {
  const favorites = usePlayerStore((s) => s.favorites);
  const playlists = usePlayerStore((s) => s.playlists);
  const selectedPlaylistId = usePlayerStore((s) => s.selectedPlaylistId);
  const settings = usePlayerStore((s) => s.settings);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const deletePlaylist = usePlayerStore((s) => s.deletePlaylist);
  const removeTrackFromPlaylist = usePlayerStore((s) => s.removeTrackFromPlaylist);
  const reorderPlaylistTracks = usePlayerStore((s) => s.reorderPlaylistTracks);
  const openCreatePlaylistModal = usePlayerStore((s) => s.openCreatePlaylistModal);
  const enqueueDownloads = usePlayerStore((s) => s.enqueueDownloads);
  const setView = usePlayerStore((s) => s.setView);
  const t = usePlayerStore((s) => s.t());

  const [filter, setFilter] = useState('');

  const playlist =
    mode === 'playlist'
      ? playlists.find((p) => p.id === selectedPlaylistId) ?? null
      : null;

  const tracks = mode === 'favorites' ? favorites : playlist?.tracks ?? [];
  const title =
    mode === 'favorites' ? t.playlist.likedSongsTitle : playlist?.name ?? 'Playlist';
  const subtitle =
    mode === 'favorites'
      ? t.playlist.likedSongsSubtitle
      : playlist?.description || '';

  const filteredTracks = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (tr) =>
        tr.title.toLowerCase().includes(q) ||
        tr.artist.toLowerCase().includes(q) ||
        tr.album.toLowerCase().includes(q)
    );
  }, [tracks, filter]);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    if (usePlayerStore.getState().shuffle) {
      usePlayerStore.getState().toggleShuffle();
    }
    void playTrack(tracks[0], tracks, { contextName: title });
  };

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    if (!usePlayerStore.getState().shuffle) {
      usePlayerStore.getState().toggleShuffle();
    }
    const randomPick = tracks[Math.floor(Math.random() * tracks.length)];
    void playTrack(randomPick, tracks, { contextName: title });
  };

  const handleReorder = (newOrder: Track[]) => {
    if (!playlist || filter.trim()) return;
    void reorderPlaylistTracks(
      playlist.id,
      newOrder.map((tr) => tr.id)
    );
  };

  return (
    <div className="space-y-6 pb-36">
      {/* Atmospheric Playlist / Liked Songs Header */}
      <div className="glass-surface relative overflow-hidden rounded-[28px] p-6 md:p-8">
        {mode === 'favorites' && (
          <div className="pointer-events-none absolute -left-16 -top-20 h-72 w-72 rounded-full bg-violet-500/25 blur-[90px]" />
        )}

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="h-36 w-36 shrink-0 overflow-hidden rounded-[22px] ring-1 ring-white/20 shadow-2xl md:h-44 md:w-44">
              <PlaylistCoverMosaic
                variant={mode === 'favorites' ? 'liked' : 'playlist'}
                title={title}
                coverUrl={playlist?.coverUrl}
                tracks={tracks}
                className="h-full w-full"
                iconSize={56}
              />
            </div>

            <div className="min-w-0">
              <span className="inline-block rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {mode === 'favorites' ? 'AUTO PLAYLIST' : 'PLAYLIST'}
              </span>
              <h1 className="mt-2.5 text-[28px] font-extrabold tracking-tight text-white md:text-[36px] leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 max-w-xl text-[14px] text-white/65">{subtitle}</p>
              )}
              <p className="mt-2 font-mono text-[12.5px] text-white/55">
                {tracks.length} {t.library.tracksUnit}
                {tracks.length > 0
                  ? ` • ${formatTotalAlbumDuration(
                      tracks.map((tr) => tr.duration),
                      settings.language
                    )}`
                  : ''}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {tracks.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePlayAll}
                      className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Play size={15} weight="fill" />
                      {t.playlist.playAll}
                    </button>

                    <button
                      type="button"
                      onClick={handleShufflePlay}
                      className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/15"
                    >
                      <Shuffle size={15} />
                      {t.album.shufflePlay}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await enqueueDownloads(tracks, title);
                        setView('downloads');
                      }}
                      className="flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/15 px-4 py-2.5 text-[13px] font-semibold text-cyan-100 hover:bg-cyan-400/25"
                    >
                      <DownloadSimple size={15} weight="bold" />
                      {t.discover.downloadAlbum}
                    </button>
                  </>
                )}

                {mode === 'playlist' && playlist && (
                  <>
                    <button
                      type="button"
                      onClick={() => openCreatePlaylistModal(playlist)}
                      title={t.playlist.editTitle}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/75 hover:bg-white/15 hover:text-white"
                    >
                      <PencilSimple size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePlaylist(playlist.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/60 hover:bg-rose-500/20 hover:text-rose-200"
                    >
                      <Trash size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {tracks.length > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-2 sm:w-64">
              <MagnifyingGlass size={14} className="text-white/45" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t.library.filterPlaceholder}
                className="w-full bg-transparent text-[13px] text-white placeholder-white/40 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.02] px-6 text-center text-white/45">
          <MusicNotes size={36} weight="light" />
          <p className="max-w-md text-[14px]">
            {mode === 'favorites' ? t.playlist.emptyLiked : t.playlist.empty}
          </p>
        </div>
      ) : mode === 'playlist' && playlist && !filter.trim() ? (
        <div className="glass-surface rounded-[22px] p-3">
          <Reorder.Group
            axis="y"
            values={tracks}
            onReorder={handleReorder}
            className="space-y-1"
          >
            {tracks.map((tr, i) => (
              <Reorder.Item
                key={tr.id}
                value={tr}
                className="flex items-center gap-1 rounded-[16px]"
              >
                <span
                  title={t.queue.dragHint}
                  className="ml-1.5 cursor-grab text-white/25 hover:text-white/65 active:cursor-grabbing"
                >
                  <DotsSixVertical size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <TrackRow
                    track={tr}
                    index={i}
                    queueContext={tracks}
                    contextName={title}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void removeTrackFromPlaylist(playlist.id, tr.id, playlist.name)
                  }
                  className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/35 hover:bg-rose-500/20 hover:text-rose-200"
                >
                  <Trash size={14} />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      ) : (
        <div className="glass-surface rounded-[22px] space-y-1 p-3">
          {filteredTracks.map((tr, i) => (
            <div key={tr.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <TrackRow
                  track={tr}
                  index={i}
                  queueContext={tracks}
                  contextName={title}
                />
              </div>
              {mode === 'playlist' && playlist && (
                <button
                  type="button"
                  onClick={() =>
                    void removeTrackFromPlaylist(playlist.id, tr.id, playlist.name)
                  }
                  className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/35 hover:bg-rose-500/20 hover:text-rose-200"
                >
                  <Trash size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
