import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  ClipboardText,
  DownloadSimple,
  LinkSimple,
  Play,
  SpinnerGap,
  SpotifyLogo,
  Square,
  YoutubeLogo,
} from '@phosphor-icons/react';
import { Track, UrlBatchParseResult } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';
import { CoverArt } from '../components/ui/CoverArt';
import { cn, formatDuration } from '../utils/format';

export const UrlBatchView: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueDownloads = usePlayerStore((s) => s.enqueueDownloads);
  const setView = usePlayerStore((s) => s.setView);
  const t = usePlayerStore((s) => s.t());

  const initialIsUrl =
    /^https?:\/\//i.test(searchQuery.trim()) || /^spotify:/i.test(searchQuery.trim());
  const [urlInput, setUrlInput] = useState(initialIsUrl ? searchQuery.trim() : '');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<UrlBatchParseResult | null>(null);
  const [albumOverride, setAlbumOverride] = useState('');
  const [artistOverride, setArtistOverride] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const inspectUrl = async (targetUrl: string) => {
    const clean = targetUrl.trim();
    if (!clean) return;
    setParsing(true);
    setError(null);
    try {
      const result = await window.aetherAPI.parseUrlBatch(clean);
      setParsed(result);
      setAlbumOverride(result.title);
      setArtistOverride(result.artist);
      setSelectedIds(new Set(result.tracks.map((tr) => tr.id)));
    } catch {
      setError(t.batchUrl.parseError);
      setParsed(null);
    } finally {
      setParsing(false);
    }
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if ((/^https?:\/\//i.test(q) || /^spotify:/i.test(q)) && q !== parsed?.sourceUrl && !parsing) {
      setUrlInput(q);
      void inspectUrl(q);
    }
  }, [searchQuery]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrlInput(text.trim());
        void inspectUrl(text.trim());
      }
    } catch {
      // Clipboard permission ignored
    }
  };

  const toggleTrack = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildCustomizedTracks = (): Track[] => {
    if (!parsed) return [];
    const customAlbum = albumOverride.trim() || parsed.title;
    const customArtist = artistOverride.trim();
    return parsed.tracks
      .filter((tr) => selectedIds.has(tr.id))
      .map((tr, i) => ({
        ...tr,
        album: customAlbum,
        artist:
          parsed.provider === 'spotify' && customArtist === parsed.artist
            ? tr.artist
            : customArtist || tr.artist,
        trackNumber: tr.trackNumber ?? i + 1,
      }));
  };

  const handleBatchDownload = async () => {
    const list = buildCustomizedTracks();
    if (list.length === 0) return;
    await enqueueDownloads(list, albumOverride.trim() || parsed?.title);
    setView('downloads');
  };

  const handlePlayParsed = () => {
    if (!parsed || parsed.tracks.length === 0) return;
    void playTrack(parsed.tracks[0], parsed.tracks);
  };

  return (
    <div className="space-y-6 pb-36">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
            <SpotifyLogo size={13} weight="fill" />
            Spotify Album & Playlist
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/15 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rose-200">
            <YoutubeLogo size={13} weight="fill" />
            YouTube Music
          </span>
        </div>

        <h1 className="mt-3 text-[28px] font-extrabold tracking-tight text-white">
          {t.batchUrl.title}
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-white/60">{t.batchUrl.subtitle}</p>
      </div>

      {/* URL Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void inspectUrl(urlInput);
        }}
        className="glass-surface flex flex-col gap-3 rounded-[22px] p-3 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-3 px-2">
          <LinkSimple size={20} className="shrink-0 text-emerald-300" />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={t.batchUrl.inputPlaceholder}
            className="w-full bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className="flex items-center gap-1.5 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-[13px] font-semibold text-white/85 hover:bg-white/12"
          >
            <ClipboardText size={15} />
            {t.batchUrl.pasteBtn}
          </button>

          <button
            type="submit"
            disabled={parsing || !urlInput.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-[13.5px] font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-45"
          >
            {parsing ? <SpinnerGap size={16} className="animate-spin" /> : null}
            {parsing ? t.batchUrl.analyzing : t.batchUrl.analyzeBtn}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-3.5 text-[13.5px] text-rose-200">
          {error}
        </div>
      )}

      {parsed && (
        <div className="space-y-5">
          <div className="glass-surface relative overflow-hidden rounded-[26px] p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="h-36 w-36 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/20 shadow-2xl">
                <CoverArt
                  src={parsed.coverUrl}
                  title={parsed.title}
                  artist={parsed.artist}
                  className="h-full w-full"
                  iconSize={42}
                  loading="eager"
                />
              </div>

              <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    {t.batchUrl.albumOverride}
                  </label>
                  <input
                    type="text"
                    value={albumOverride}
                    onChange={(e) => setAlbumOverride(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[13.5px] text-white outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    {t.batchUrl.artistOverride}
                  </label>
                  <input
                    type="text"
                    value={artistOverride}
                    onChange={(e) => setArtistOverride(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[13.5px] text-white outline-none focus:border-white/30"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={() => void handleBatchDownload()}
                    className="flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-[13.5px] font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                  >
                    <DownloadSimple size={16} weight="bold" />
                    {t.batchUrl.downloadSelected.replace('{count}', String(selectedIds.size))}
                  </button>

                  <button
                    type="button"
                    onClick={handlePlayParsed}
                    className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/15"
                  >
                    <Play size={15} weight="fill" />
                    {t.batchUrl.playList}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set(parsed.tracks.map((tr) => tr.id)))}
                    className="text-[12.5px] font-medium text-white/70 hover:text-white"
                  >
                    {t.batchUrl.selectAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[12.5px] font-medium text-white/50 hover:text-white"
                  >
                    {t.batchUrl.deselectAll}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-surface rounded-[22px] space-y-1 p-3">
            {parsed.tracks.map((tr, i) => {
              const checked = selectedIds.has(tr.id);
              return (
                <div
                  key={tr.id}
                  onClick={() => toggleTrack(tr.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3.5 rounded-2xl px-3.5 py-2.5 transition-colors',
                    checked ? 'bg-white/[0.05] hover:bg-white/[0.09]' : 'opacity-45 hover:opacity-75'
                  )}
                >
                  <span className="text-emerald-300">
                    {checked ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                  </span>
                  <span className="w-6 font-mono text-[12px] text-white/45 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <CoverArt
                    src={tr.coverUrl}
                    title={tr.title}
                    artist={tr.artist}
                    className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-white/10"
                    iconSize={15}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-white">{tr.title}</p>
                    <p className="truncate text-[12px] text-white/55">{tr.artist}</p>
                  </div>
                  <span className="font-mono text-[12px] text-white/45 tabular-nums">
                    {formatDuration(tr.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
