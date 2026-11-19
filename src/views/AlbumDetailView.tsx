import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  DownloadSimple,
  Play,
  Shuffle,
  SpinnerGap,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../store/usePlayerStore';
import { TrackRow } from '../components/cards/TrackRow';
import { CoverArt } from '../components/ui/CoverArt';
import { formatTotalAlbumDuration } from '../utils/format';

export const AlbumDetailView: React.FC = () => {
  const album = usePlayerStore((s) => s.selectedAlbum);
  const albumLoading = usePlayerStore((s) => s.albumLoading);
  const downloadedTracks = usePlayerStore((s) => s.downloadedTracks);
  const settings = usePlayerStore((s) => s.settings);
  const setView = usePlayerStore((s) => s.setView);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueDownloads = usePlayerStore((s) => s.enqueueDownloads);
  const t = usePlayerStore((s) => s.t());

  if (!album) {
    return (
      <div className="py-16 text-center text-white/50">
        <button
          type="button"
          onClick={() => setView('discover')}
          className="rounded-full bg-white/10 px-4 py-2 text-white"
        >
          {t.album.back}
        </button>
      </div>
    );
  }

  const tracks = album.tracks ?? [];
  const offlineCount = tracks.filter((tr) =>
    Boolean(tr.localPath || downloadedTracks[tr.id]?.localPath)
  ).length;
  const allDownloaded = tracks.length > 0 && offlineCount === tracks.length;

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    if (usePlayerStore.getState().shuffle) {
      usePlayerStore.getState().toggleShuffle();
    }
    void playTrack(tracks[0], tracks, { contextName: album.title });
  };

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    if (!usePlayerStore.getState().shuffle) {
      usePlayerStore.getState().toggleShuffle();
    }
    const randomPick = tracks[Math.floor(Math.random() * tracks.length)];
    void playTrack(randomPick, tracks, { contextName: album.title });
  };

  const handleDownloadWholeAlbum = async () => {
    if (tracks.length === 0) return;
    await enqueueDownloads(tracks, album.title);
    setView('downloads');
  };

  return (
    <div className="space-y-6 pb-36">
      <button
        type="button"
        onClick={() => setView('discover')}
        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-1.5 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft size={15} />
        {t.album.back}
      </button>

      {/* Atmospheric Album Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="glass-surface relative overflow-hidden rounded-[28px]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <CoverArt
            src={album.coverUrl}
            title={album.title}
            artist={album.artist}
            className="h-full w-full scale-125 blur-[72px]"
            iconSize={0}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07080C]/85 via-[#07080C]/45 to-transparent" />

        <div className="relative z-10 flex flex-col gap-6 p-5 lg:flex-row lg:items-end lg:gap-7 lg:p-7">
          <div className="h-40 w-40 shrink-0 overflow-hidden rounded-[22px] ring-1 ring-white/20 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] lg:h-56 lg:w-56">
            <CoverArt
              src={album.coverUrl}
              title={album.title}
              artist={album.artist}
              className="h-full w-full"
              iconSize={64}
              loading="eager"
            />
          </div>

          <div className="flex-1 min-w-0">
            <span className="inline-block rounded-full border border-white/15 bg-white/[0.09] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/85">
              {album.source === 'spotify'
                ? 'SPOTIFY ALBUM'
                : album.source === 'youtube'
                  ? 'YOUTUBE MUSIC'
                  : t.album.officialAlbum}
            </span>

            <h1 className="mt-3 line-clamp-2 text-[24px] font-extrabold leading-[1.18] tracking-tight text-white lg:text-[34px]">
              {album.title}
            </h1>

            <p className="mt-1.5 text-[15.5px] font-medium text-white/75">
              {album.artist}
              {album.year ? ` • ${album.year}` : ''}
              {tracks.length > 0
                ? ` • ${tracks.length} ${t.discover.tracksCount} • ${formatTotalAlbumDuration(
                    tracks.map((tr) => tr.duration),
                    settings.language
                  )}`
                : ''}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={tracks.length === 0}
                onClick={handlePlayAll}
                className="group flex items-center gap-3 rounded-full bg-white py-2 pl-5 pr-2 text-[13.5px] font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-45"
              >
                <span>{t.album.playAll}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition-transform group-hover:translate-x-0.5">
                  <Play size={15} weight="fill" />
                </span>
              </button>

              <button
                type="button"
                disabled={tracks.length === 0}
                onClick={handleShufflePlay}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2.5 text-[13px] font-semibold text-white/90 hover:bg-white/15 disabled:opacity-45"
              >
                <Shuffle size={15} />
                {t.album.shufflePlay}
              </button>

              <button
                type="button"
                disabled={tracks.length === 0}
                onClick={() => void handleDownloadWholeAlbum()}
                className="group flex items-center gap-3 rounded-full border border-cyan-300/35 bg-cyan-400/15 py-2 pl-5 pr-2 text-[13.5px] font-semibold text-cyan-100 transition-all hover:bg-cyan-400/25 active:scale-[0.98] disabled:opacity-45"
              >
                <span>
                  {allDownloaded
                    ? t.album.downloadedCount
                        .replace('{done}', String(offlineCount))
                        .replace('{total}', String(tracks.length))
                    : t.album.downloadWholeAlbum}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300/20">
                  {allDownloaded ? (
                    <CheckCircle size={16} weight="fill" className="text-emerald-300" />
                  ) : (
                    <DownloadSimple size={16} weight="bold" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tracklist with CoverArt enabled */}
      <div className="glass-surface rounded-[24px] p-3 md:p-4">
        {albumLoading && tracks.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center gap-3 text-white/55">
            <SpinnerGap size={26} className="animate-spin" />
            <p className="text-[13.5px]">{t.album.loadingAlbum}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((tr, i) => (
              <TrackRow
                key={tr.id}
                track={tr}
                index={i}
                queueContext={tracks}
                contextName={album.title}
                showCover={true}
                showAlbum={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
