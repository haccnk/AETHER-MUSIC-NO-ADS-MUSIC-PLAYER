import React, { useEffect, useState } from 'react';
import { MagnifyingGlass, SpinnerGap, YoutubeLogo, Disc } from '@phosphor-icons/react';
import { Album, Track } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';
import { AlbumCard } from '../components/cards/AlbumCard';
import { TrackRow } from '../components/cards/TrackRow';
import { cn } from '../utils/format';

export const SearchView: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const openAlbum = usePlayerStore((s) => s.openAlbum);
  const setView = usePlayerStore((s) => s.setView);
  const t = usePlayerStore((s) => s.t());

  const [mode, setMode] = useState<'catalog' | 'youtube'>('catalog');
  const [loading, setLoading] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [ytTracks, setYtTracks] = useState<Track[]>([]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setAlbums([]);
      setTracks([]);
      setYtTracks([]);
      return;
    }

    if (/^https?:\/\//i.test(q) || /^spotify:/i.test(q)) {
      setView('batch-url');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (mode === 'catalog') {
          const res = await window.aetherAPI.searchCatalog(q);
          if (!cancelled) {
            setAlbums(res.albums);
            setTracks(res.tracks);
          }
        } else {
          const list = await window.aetherAPI.searchYouTubeMusic(q);
          if (!cancelled) {
            setYtTracks(list);
          }
        }
      } catch {
        // Ignore network errors cleanly
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 360);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, mode, setView]);

  return (
    <div className="space-y-6 pb-36">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-white">
            {t.search.title}
          </h1>
          <p className="mt-1 text-[13.5px] text-white/55">{t.search.ytHint}</p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setMode('catalog')}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all',
              mode === 'catalog'
                ? 'bg-white text-black shadow'
                : 'text-white/65 hover:text-white'
            )}
          >
            <Disc size={15} weight={mode === 'catalog' ? 'fill' : 'regular'} />
            {t.search.catalogTab}
          </button>
          <button
            type="button"
            onClick={() => setMode('youtube')}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all',
              mode === 'youtube'
                ? 'bg-white text-black shadow'
                : 'text-white/65 hover:text-white'
            )}
          >
            <YoutubeLogo size={15} weight={mode === 'youtube' ? 'fill' : 'regular'} />
            {t.search.ytTab}
          </button>
        </div>
      </div>

      {/* Inline Search Box */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 focus-within:border-white/30">
        <MagnifyingGlass size={18} className="text-white/50" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.search.placeholder}
          className="w-full bg-transparent text-[14.5px] text-white placeholder-white/40 outline-none"
        />
      </div>

      {!searchQuery.trim() ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.02] text-center text-white/45">
          <MagnifyingGlass size={36} weight="light" />
          <p className="max-w-md text-[14px]">{t.search.emptyPrompt}</p>
        </div>
      ) : loading ? (
        <div className="flex h-56 flex-col items-center justify-center gap-3 text-white/60">
          <SpinnerGap size={28} className="animate-spin" />
          <p className="text-[13.5px]">{t.search.searching}</p>
        </div>
      ) : mode === 'catalog' ? (
        albums.length === 0 && tracks.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-white/50">{t.search.noResults}</p>
        ) : (
          <div className="space-y-8">
            {albums.length > 0 && (
              <section>
                <h2 className="mb-3.5 text-[18px] font-bold text-white">
                  {t.search.albumsHeading}
                </h2>
                <div className="cq-albums-grid">
                  {albums.map((al) => (
                    <AlbumCard
                      key={al.id}
                      album={al}
                      onOpen={(a) => void openAlbum(a.id, a)}
                    />
                  ))}
                </div>
              </section>
            )}

            {tracks.length > 0 && (
              <section>
                <h2 className="mb-3.5 text-[18px] font-bold text-white">
                  {t.search.tracksHeading}
                </h2>
                <div className="bezel-outer">
                  <div className="bezel-inner space-y-1 p-3">
                    {tracks.map((tr, i) => (
                      <TrackRow key={tr.id} track={tr} index={i} queueContext={tracks} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )
      ) : ytTracks.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-white/50">{t.search.noResults}</p>
      ) : (
        <div className="bezel-outer">
          <div className="bezel-inner space-y-1 p-3">
            {ytTracks.map((tr, i) => (
              <TrackRow key={tr.id} track={tr} index={i} queueContext={ytTracks} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
