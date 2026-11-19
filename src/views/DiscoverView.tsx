import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  DownloadSimple,
  Play,
  Sparkle,
  SpinnerGap,
  SpotifyLogo,
  WifiSlash,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../store/usePlayerStore';
import { AlbumCard } from '../components/cards/AlbumCard';
import { TrackRow } from '../components/cards/TrackRow';
import { CoverArt } from '../components/ui/CoverArt';
import { formatTotalAlbumDuration } from '../utils/format';

export const DiscoverView: React.FC = () => {
  const feed = usePlayerStore((s) => s.discoverFeed);
  const loading = usePlayerStore((s) => s.discoverLoading);
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);
  const settings = usePlayerStore((s) => s.settings);
  const openAlbum = usePlayerStore((s) => s.openAlbum);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueDownloads = usePlayerStore((s) => s.enqueueDownloads);
  const setView = usePlayerStore((s) => s.setView);
  const t = usePlayerStore((s) => s.t());

  if (loading && !feed) {
    return (
      <div className="flex h-[65vh] flex-col items-center justify-center gap-3 text-white/60">
        <SpinnerGap size={32} className="animate-spin" />
        <p className="text-[14px]">{t.discover.loadingFeed}</p>
      </div>
    );
  }

  const featured = feed?.featuredAlbum;
  const hasOnlineFeed = Boolean(
    featured || (feed?.vnAlbums.length ?? 0) > 0 || (feed?.intlAlbums.length ?? 0) > 0
  );

  return (
    <div className="space-y-10 pb-36">
      {!hasOnlineFeed && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-3.5">
          <div className="flex items-center gap-3 text-amber-200">
            <WifiSlash size={20} />
            <span className="text-[13.5px] font-medium">{t.discover.offlineBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setView('library')}
            className="rounded-full bg-white px-4 py-1.5 text-[12.5px] font-semibold text-black"
          >
            {t.nav.library}
          </button>
        </div>
      )}

      {/* Featured Hero Album */}
      {featured && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          className="glass-surface relative overflow-hidden rounded-[28px]"
        >
          {/* Blurred cover atmospheric wash */}
          <div className="pointer-events-none absolute inset-0 opacity-35">
            <CoverArt
              src={featured.coverUrl}
              title={featured.title}
              artist={featured.artist}
              className="h-full w-full scale-125 blur-[72px]"
              iconSize={0}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#07080C]/85 via-[#07080C]/55 to-transparent" />

          <div className="relative z-10 flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:gap-7 lg:p-7">
            <div
              onClick={() => void openAlbum(featured.id, featured)}
              className="group relative h-40 w-40 shrink-0 cursor-pointer overflow-hidden rounded-[22px] ring-1 ring-white/20 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] lg:h-52 lg:w-52"
            >
              <CoverArt
                src={featured.coverUrl}
                title={featured.title}
                artist={featured.artist}
                className="h-full w-full"
                imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                iconSize={56}
                loading="eager"
              />
            </div>

            <div className="relative z-10 flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.1] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                <Sparkle size={12} weight="fill" className="text-cyan-300" />
                {t.discover.featuredBadge}
              </span>

              <h1
                onClick={() => void openAlbum(featured.id, featured)}
                className="mt-3 cursor-pointer line-clamp-2 text-[24px] font-extrabold leading-[1.18] tracking-tight text-white lg:text-[34px]"
              >
                {featured.title}
              </h1>

              <p className="mt-1.5 text-[14.5px] font-medium text-white/75 lg:text-[15.5px]">
                {featured.artist}
                {featured.year ? ` • ${featured.year}` : ''}
                {featured.tracks?.length
                  ? ` • ${featured.tracks.length} ${t.discover.tracksCount} (${formatTotalAlbumDuration(
                      featured.tracks.map((tr) => tr.duration),
                      settings.language
                    )})`
                  : ''}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (featured.tracks && featured.tracks.length > 0) {
                      void playTrack(featured.tracks[0], featured.tracks);
                    } else {
                      void openAlbum(featured.id, featured);
                    }
                  }}
                  className="group flex items-center gap-3 rounded-full bg-white py-2 pl-5 pr-2 text-[13.5px] font-bold text-black shadow-lg transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>{t.discover.playNow}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:translate-x-0.5">
                    <Play size={15} weight="fill" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const tracks =
                      featured.tracks && featured.tracks.length > 0
                        ? featured.tracks
                        : (await window.aetherAPI.getAlbumDetails(featured.id))?.tracks ?? [];
                    if (tracks.length > 0) {
                      await enqueueDownloads(tracks, featured.title);
                      setView('downloads');
                    }
                  }}
                  className="group flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.09] py-2 pl-5 pr-2 text-[13.5px] font-semibold text-white backdrop-blur-md transition-all hover:bg-white/[0.16] active:scale-[0.98]"
                >
                  <span>{t.discover.downloadAlbum}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                    <DownloadSimple size={15} weight="bold" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setView('batch-url')}
                  className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2.5 text-[13px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25"
                >
                  <SpotifyLogo size={16} weight="fill" />
                  {t.discover.spotifyImportShortcut}
                </button>

                <button
                  type="button"
                  onClick={() => void openAlbum(featured.id, featured)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/15 hover:text-white"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <section>
          <h2 className="mb-3.5 text-[20px] font-bold tracking-tight text-white">
            {t.discover.recentSection}
          </h2>
          <div className="cq-recent-grid">
            {recentlyPlayed.slice(0, 6).map((tr, i) => (
              <TrackRow
                key={tr.id}
                track={tr}
                index={i}
                queueContext={recentlyPlayed}
                showAlbum={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* V-Pop & Indie Albums */}
      {feed && feed.vnAlbums.length > 0 && (
        <section>
          <h2 className="mb-4 text-[20px] font-bold tracking-tight text-white">
            {t.discover.vnSection}
          </h2>
          <div className="cq-albums-grid">
            {feed.vnAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onOpen={(a) => void openAlbum(a.id, a)}
              />
            ))}
          </div>
        </section>
      )}

      {/* International Masterpieces */}
      {feed && feed.intlAlbums.length > 0 && (
        <section>
          <h2 className="mb-4 text-[20px] font-bold tracking-tight text-white">
            {t.discover.intlSection}
          </h2>
          <div className="cq-albums-grid">
            {feed.intlAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onOpen={(a) => void openAlbum(a.id, a)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending Songs */}
      {feed && feed.trendingTracks.length > 0 && (
        <section>
          <h2 className="mb-4 text-[20px] font-bold tracking-tight text-white">
            {t.discover.trendingSongs}
          </h2>
          <div className="glass-surface rounded-[22px] p-3 space-y-1">
            {feed.trendingTracks.map((tr, i) => (
              <TrackRow
                key={tr.id}
                track={tr}
                index={i}
                queueContext={feed.trendingTracks}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
