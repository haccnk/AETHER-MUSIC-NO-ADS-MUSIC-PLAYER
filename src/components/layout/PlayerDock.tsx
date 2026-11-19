import React, { useState } from 'react';
import {
  ArrowsOut,
  Desktop,
  FilmSlate,
  Heart,
  ListPlus,
  MoonStars,
  Pause,
  Play,
  Queue,
  Repeat,
  RepeatOnce,
  Shuffle,
  SidebarSimple,
  SkipBack,
  SkipForward,
  Sliders,
  SpeakerHigh,
  SpeakerX,
  SpinnerGap,
  TextAlignLeft,
} from '@phosphor-icons/react';
import { audioEngine, usePlaybackTime } from '../../audio/AudioEngine';
import { usePlayerStore } from '../../store/usePlayerStore';
import { cn, formatDuration, formatMs } from '../../utils/format';
import { FrequencyVisualizer } from '../audio/FrequencyVisualizer';
import { CoverArt } from '../ui/CoverArt';

export const PlayerDock: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoadingStream = usePlayerStore((s) => s.isLoadingStream);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const favorites = usePlayerStore((s) => s.favorites);
  const downloadedTracks = usePlayerStore((s) => s.downloadedTracks);
  const priorityQueue = usePlayerStore((s) => s.priorityQueue);
  const sleepTimer = usePlayerStore((s) => s.sleepTimer);
  const isImmersiveLyricsOpen = usePlayerStore((s) => s.isImmersiveLyricsOpen);
  const isDesktopLyricsOpen = usePlayerStore((s) => s.isDesktopLyricsOpen);
  const isEqOpen = usePlayerStore((s) => s.isEqOpen);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const isRightPanelOpen = usePlayerStore((s) => s.isRightPanelOpen);

  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleFavorite = usePlayerStore((s) => s.toggleFavorite);
  const openAddToPlaylistModal = usePlayerStore((s) => s.openAddToPlaylistModal);
  const setImmersiveLyricsOpen = usePlayerStore((s) => s.setImmersiveLyricsOpen);
  const toggleDesktopLyrics = usePlayerStore((s) => s.toggleDesktopLyrics);
  const setEqOpen = usePlayerStore((s) => s.setEqOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const toggleRightPanel = usePlayerStore((s) => s.toggleRightPanel);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const currentMv = usePlayerStore((s) => s.currentMv);
  const isMvOpen = usePlayerStore((s) => s.isMvOpen);
  const openMvModal = usePlayerStore((s) => s.openMvModal);
  const t = usePlayerStore((s) => s.t());

  const { currentTimeMs, durationMs } = usePlaybackTime();
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);

  const effectiveDurMs =
    durationMs > 0 ? durationMs : currentTrack ? currentTrack.duration * 1000 : 0;
  const progressPct =
    effectiveDurMs > 0
      ? Math.min(100, Math.max(0, (currentTimeMs / effectiveDurMs) * 100))
      : 0;

  const isFav = currentTrack ? favorites.some((f) => f.id === currentTrack.id) : false;
  const isOffline = currentTrack
    ? Boolean(currentTrack.localPath || downloadedTracks[currentTrack.id]?.localPath)
    : false;

  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack || effectiveDurMs <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioEngine.seek(ratio * effectiveDurMs);
  };

  return (
    <div className="pointer-events-none fixed bottom-3.5 left-3.5 right-3.5 z-20 flex justify-center">
      <div className="pointer-events-auto relative grid h-[82px] w-full max-w-[1480px] grid-cols-[minmax(180px,1fr)_minmax(260px,1.25fr)_minmax(210px,1fr)] items-center gap-3 rounded-[24px] border border-white/13 bg-[#0B0D14]/86 px-4 shadow-[0_24px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl">
        {/* Left: Cover + Track Info + Heart + Add to Playlist */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            onClick={() => currentTrack && setImmersiveLyricsOpen(!isImmersiveLyricsOpen)}
            className="group relative h-12 w-12 lg:h-14 lg:w-14 shrink-0 cursor-pointer overflow-hidden rounded-[13px] ring-1 ring-white/15"
          >
            <CoverArt
              src={currentTrack?.coverUrl}
              title={currentTrack?.title || 'Aether'}
              artist={currentTrack?.artist}
              className="h-full w-full"
              imgClassName="transition-transform duration-500 group-hover:scale-110"
              iconSize={22}
              loading="eager"
            />
            {currentTrack && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowsOut size={16} weight="bold" className="text-white" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            {currentTrack ? (
              <>
                <div className="flex min-w-0 items-center gap-1.5">
                  <p
                    onClick={() => setImmersiveLyricsOpen(true)}
                    className="min-w-0 cursor-pointer truncate text-[13.5px] font-semibold text-white hover:underline"
                  >
                    {currentTrack.title}
                  </p>
                  {isOffline && (
                    <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9.5px] text-emerald-300">
                      320k
                    </span>
                  )}
                </div>
                <p className="truncate text-[12px] text-white/55">
                  {isLoadingStream ? t.player.streamLoading : currentTrack.artist}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-[13px] font-medium text-white/75">
                  {t.player.nothingPlaying}
                </p>
                <p className="truncate text-[11.5px] text-white/40">{t.player.chooseTrack}</p>
              </>
            )}
          </div>

          {currentTrack && (
            <div className="ml-0.5 flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => void toggleFavorite(currentTrack)}
                title={isFav ? t.playlist.likedToggleRemove : t.playlist.likedToggleAdd}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90 hover:bg-white/10',
                  isFav ? 'text-rose-400' : 'text-white/45 hover:text-white'
                )}
              >
                <Heart size={16} weight={isFav ? 'fill' : 'regular'} />
              </button>
              <button
                type="button"
                onClick={() => openAddToPlaylistModal(currentTrack)}
                title={t.album.addToPlaylist}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ListPlus size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Center: Transport & Seekbar */}
        <div className="flex w-full max-w-[520px] mx-auto flex-col items-center gap-1.5">
          <div className="flex items-center gap-2.5 lg:gap-3.5">
            <button
              type="button"
              onClick={toggleShuffle}
              title={t.album.shufflePlay}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                shuffle ? 'text-cyan-300 bg-cyan-400/15' : 'text-white/50 hover:text-white'
              )}
            >
              <Shuffle size={15} />
            </button>

            <button
              type="button"
              onClick={() => void prevTrack()}
              disabled={!currentTrack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-transform hover:text-white active:scale-90 disabled:opacity-35"
            >
              <SkipBack size={18} weight="fill" />
            </button>

            <button
              type="button"
              onClick={() => void togglePlayPause()}
              disabled={!currentTrack}
              className="flex h-9 w-9 lg:h-10 lg:w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 disabled:opacity-40"
            >
              {isLoadingStream ? (
                <SpinnerGap size={18} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={17} weight="fill" />
              ) : (
                <Play size={17} weight="fill" className="ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void nextTrack(false)}
              disabled={!currentTrack}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-transform hover:text-white active:scale-90 disabled:opacity-35"
            >
              <SkipForward size={18} weight="fill" />
            </button>

            <button
              type="button"
              onClick={cycleRepeat}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                repeat !== 'off'
                  ? 'text-cyan-300 bg-cyan-400/15'
                  : 'text-white/50 hover:text-white'
              )}
            >
              {repeat === 'one' ? <RepeatOnce size={15} /> : <Repeat size={15} />}
            </button>
          </div>

          <div className="flex w-full items-center gap-2">
            <span className="w-8 shrink-0 text-right font-mono text-[10.5px] text-white/50 tabular-nums">
              {formatMs(currentTimeMs)}
            </span>
            <div
              onClick={handleSeekBarClick}
              className="group relative flex h-3 flex-1 cursor-pointer items-center"
            >
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/15 transition-all group-hover:h-1.5">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-75"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <span className="w-8 shrink-0 font-mono text-[10.5px] text-white/50 tabular-nums">
              {formatMs(effectiveDurMs)}
            </span>
          </div>
        </div>

        {/* Right: Visualizer, Lyrics, Desktop Lyrics, EQ, Sleep Timer, Studio Panel, Volume */}
        <div className="relative flex min-w-0 items-center justify-end gap-1">
          <div className="hidden 2xl:block mr-1 shrink-0">
            <FrequencyVisualizer bars={14} width={58} height={22} />
          </div>

          {currentMv && (
            <button
              type="button"
              onClick={() => void openMvModal()}
              title={t.mv.watchMv}
              className={cn(
                'flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 font-mono text-[10.5px] font-bold transition-all hover:scale-105',
                isMvOpen
                  ? 'border-cyan-300 bg-cyan-300 text-black'
                  : 'border-cyan-400/35 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25'
              )}
            >
              <FilmSlate size={13} weight="fill" />
              <span>{t.mv.badge}</span>
            </button>
          )}

          <button
            type="button"
            disabled={!currentTrack}
            onClick={() => setImmersiveLyricsOpen(!isImmersiveLyricsOpen)}
            title={t.player.lyrics}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-35',
              isImmersiveLyricsOpen
                ? 'bg-white text-black'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <TextAlignLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => void toggleDesktopLyrics()}
            title={t.player.desktopLyrics}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              isDesktopLyricsOpen
                ? 'bg-cyan-400/20 text-cyan-300'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <Desktop size={16} />
          </button>

          <button
            type="button"
            onClick={() => setEqOpen(!isEqOpen)}
            title={t.player.equalizer}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              isEqOpen
                ? 'bg-violet-400/20 text-violet-300'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <Sliders size={16} />
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSleepMenuOpen((v) => !v)}
              title={t.player.sleepTimer}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                sleepTimer.mode !== 'off'
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              <MoonStars size={16} />
            </button>

            {sleepMenuOpen && (
              <div className="absolute bottom-11 right-0 z-30 w-48 rounded-2xl border border-white/15 bg-[#0E1019]/95 p-2 shadow-2xl backdrop-blur-2xl">
                {sleepTimer.mode !== 'off' && (
                  <p className="px-2.5 py-1 font-mono text-[11px] text-amber-300">
                    {sleepTimer.mode === 'end-of-track'
                      ? t.player.sleepEndTrack
                      : t.player.sleepActive.replace(
                          '{time}',
                          formatDuration(sleepTimer.remainingSec)
                        )}
                  </p>
                )}
                {[
                  { label: t.player.sleepOff, val: null },
                  { label: t.player.sleepEndTrack, val: 'end-of-track' as const },
                  { label: t.player.sleepMinutes.replace('{m}', '15'), val: 15 },
                  { label: t.player.sleepMinutes.replace('{m}', '30'), val: 30 },
                  { label: t.player.sleepMinutes.replace('{m}', '45'), val: 45 },
                  { label: t.player.sleepMinutes.replace('{m}', '60'), val: 60 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setSleepTimer(opt.val);
                      setSleepMenuOpen(false);
                    }}
                    className="w-full rounded-xl px-2.5 py-1.5 text-left text-[12.5px] text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setQueueOpen(!isQueueOpen)}
            title={t.player.queue}
            className={cn(
              'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              isQueueOpen
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <Queue size={16} />
            {priorityQueue.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-cyan-400 px-1 font-mono text-[9px] font-bold text-black">
                {priorityQueue.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleRightPanel}
            title={t.player.studioPanel}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              isRightPanelOpen
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <SidebarSimple size={16} />
          </button>

          <div
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.05 : -0.05;
              const next = Math.max(0, Math.min(1, (muted ? 0 : volume) + delta));
              setVolume(Number(next.toFixed(2)), false);
            }}
            className="flex items-center gap-2 pl-1 shrink-0"
          >
            <button
              type="button"
              onClick={() => setVolume(volume, !muted)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white"
            >
              {muted || volume === 0 ? <SpeakerX size={16} /> : <SpeakerHigh size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value), false)}
              style={
                {
                  '--range-pct': `${Math.round((muted ? 0 : volume) * 100)}%`,
                } as React.CSSProperties
              }
              className="aether-range w-[84px] shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
