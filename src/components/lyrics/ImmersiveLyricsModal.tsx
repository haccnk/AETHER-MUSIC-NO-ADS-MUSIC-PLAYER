import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowsClockwise,
  CaretDown,
  Crosshair,
  Desktop,
  FilmSlate,
  Minus,
  MusicNote,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  SpinnerGap,
} from '@phosphor-icons/react';
import { audioEngine, usePlaybackTime } from '../../audio/AudioEngine';
import { usePlayerStore } from '../../store/usePlayerStore';
import { rgbToCss } from '../../utils/colorExtractor';
import { cn, formatMs } from '../../utils/format';
import { FrequencyVisualizer } from '../audio/FrequencyVisualizer';
import { CoverArt } from '../ui/CoverArt';

const BASE_VOCAL_LEAD_MS = 55;

export const ImmersiveLyricsModal: React.FC = () => {
  const isOpen = usePlayerStore((s) => s.isImmersiveLyricsOpen);
  const setOpen = usePlayerStore((s) => s.setImmersiveLyricsOpen);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const lyricsPayload = usePlayerStore((s) => s.lyricsPayload);
  const lyricsLoading = usePlayerStore((s) => s.lyricsLoading);
  const palette = usePlayerStore((s) => s.ambientPalette);
  const settings = usePlayerStore((s) => s.settings);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);
  const adjustLyricOffset = usePlayerStore((s) => s.adjustLyricOffset);
  const setLyricOffsetExact = usePlayerStore((s) => s.setLyricOffsetExact);
  const toggleDesktopLyrics = usePlayerStore((s) => s.toggleDesktopLyrics);
  const isDesktopLyricsOpen = usePlayerStore((s) => s.isDesktopLyricsOpen);
  const currentMv = usePlayerStore((s) => s.currentMv);
  const openMvModal = usePlayerStore((s) => s.openMvModal);
  const t = usePlayerStore((s) => s.t());

  const { currentTimeMs, durationMs } = usePlaybackTime();
  const trackOffsetMs = currentTrack ? settings.lyricOffsets[currentTrack.id] ?? 0 : 0;
  const effectiveTimeMs =
    currentTimeMs - audioEngine.getOutputLatencyMs() + BASE_VOCAL_LEAD_MS + trackOffsetMs;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [manualScroll, setManualScroll] = useState(false);
  const manualTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const springPosRef = useRef(0);
  const springVelRef = useRef(0);
  const targetScrollRef = useRef(0);
  const springRafRef = useRef<number | null>(null);

  const lines = lyricsPayload?.lines ?? [];

  const activeIndex = useMemo(() => {
    if (!lyricsPayload?.synced || lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (effectiveTimeMs >= lines[i].timeMs) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [effectiveTimeMs, lines, lyricsPayload?.synced]);

  useEffect(() => {
    setManualScroll(false);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      springPosRef.current = 0;
      springVelRef.current = 0;
      targetScrollRef.current = 0;
    }
  }, [currentTrack?.id, isOpen, lyricsPayload?.selectedCandidateId]);

  useEffect(() => {
    if (!isOpen || manualScroll || activeIndex < 0) return;
    const container = containerRef.current;
    const el = lineRefs.current[activeIndex];
    if (!container || !el) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const relativeTop = elRect.top - containerRect.top + container.scrollTop;
    const target = Math.max(
      0,
      relativeTop - containerRect.height * 0.36 + elRect.height * 0.5
    );
    targetScrollRef.current = target;
  }, [activeIndex, isOpen, manualScroll]);

  useEffect(() => {
    if (!isOpen) return;

    const stiffness = 170;
    const damping = 26;
    const mass = 0.9;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;

      const container = containerRef.current;
      if (container && !manualScroll) {
        const diff = targetScrollRef.current - springPosRef.current;
        if (Math.abs(diff) > 0.35 || Math.abs(springVelRef.current) > 0.35) {
          const force = stiffness * diff - damping * springVelRef.current;
          const acc = force / mass;
          springVelRef.current += acc * dt;
          springPosRef.current += springVelRef.current * dt;
          container.scrollTop = springPosRef.current;
        }
      } else if (container && manualScroll) {
        springPosRef.current = container.scrollTop;
        springVelRef.current = 0;
      }

      springRafRef.current = requestAnimationFrame(step);
    };

    springRafRef.current = requestAnimationFrame(step);
    return () => {
      if (springRafRef.current !== null) cancelAnimationFrame(springRafRef.current);
    };
  }, [isOpen, manualScroll]);

  const handleUserWheel = () => {
    setManualScroll(true);
    if (manualTimeoutRef.current) clearTimeout(manualTimeoutRef.current);
    manualTimeoutRef.current = setTimeout(() => {
      setManualScroll(false);
    }, 5500);
  };

  const handleResync = () => {
    setManualScroll(false);
    if (manualTimeoutRef.current) clearTimeout(manualTimeoutRef.current);
  };

  const handleSeekToLine = (timeMs: number) => {
    setManualScroll(false);
    audioEngine.seek(Math.max(0, timeMs - trackOffsetMs));
  };

  // One-click align a specific lyric line to the exact current playback moment
  const handleSyncLineToNow = (lineTimeMs: number) => {
    if (!currentTrack) return;
    const exactOffset = Math.round(
      lineTimeMs - (currentTimeMs - audioEngine.getOutputLatencyMs() + BASE_VOCAL_LEAD_MS)
    );
    void setLyricOffsetExact(currentTrack.id, exactOffset);
    setManualScroll(false);
  };

  const accent = rgbToCss(palette[0], 0.55);
  const accentBright = rgbToCss(palette[1], 0.85);
  const progressPct =
    durationMs > 0 ? Math.min(100, Math.max(0, (currentTimeMs / durationMs) * 100)) : 0;

  return (
    <AnimatePresence>
      {isOpen && currentTrack && (
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ duration: 0.48, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[#06070B]/92 backdrop-blur-3xl"
        >
          <div
            className="pointer-events-none absolute -left-24 top-1/4 h-[520px] w-[520px] rounded-full opacity-35 blur-[130px] transition-colors duration-1000"
            style={{ backgroundColor: accent }}
          />
          <div
            className="pointer-events-none absolute right-0 bottom-0 h-[480px] w-[480px] rounded-full opacity-25 blur-[140px] transition-colors duration-1000"
            style={{ backgroundColor: accentBright }}
          />

          {/* Top Bar */}
          <div className="app-drag relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 lg:px-8 pt-5 lg:pt-8 pb-2">
            <div className="app-no-drag flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {t.lyrics.title}
              </span>
            </div>

            <div className="app-no-drag flex items-center gap-2.5">
              {currentMv && (
                <button
                  type="button"
                  onClick={() => void openMvModal()}
                  className="flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-3.5 py-1.5 text-[12px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/25"
                >
                  <FilmSlate size={15} weight="fill" />
                  {t.mv.watchMv}
                </button>
              )}
              {/* Fine 0.1s Offset Controls + Reset */}
              <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1">
                <span className="mr-1 text-[11.5px] text-white/55">{t.lyrics.offsetLabel}</span>
                <button
                  type="button"
                  onClick={() => void adjustLyricOffset(currentTrack.id, -100)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white"
                >
                  <Minus size={12} />
                </button>
                <span className="w-12 text-center font-mono text-[11.5px] text-white tabular-nums">
                  {trackOffsetMs >= 0
                    ? `+${(trackOffsetMs / 1000).toFixed(1)}s`
                    : `${(trackOffsetMs / 1000).toFixed(1)}s`}
                </span>
                <button
                  type="button"
                  onClick={() => void adjustLyricOffset(currentTrack.id, 100)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white"
                >
                  <Plus size={12} />
                </button>
                {trackOffsetMs !== 0 && (
                  <button
                    type="button"
                    onClick={() => void setLyricOffsetExact(currentTrack.id, 0)}
                    title={t.lyrics.resetOffset}
                    className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-white/20"
                  >
                    0.0s
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => void toggleDesktopLyrics()}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors',
                  isDesktopLyricsOpen
                    ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200'
                    : 'border-white/12 bg-white/[0.05] text-white/75 hover:bg-white/12 hover:text-white'
                )}
              >
                <Desktop size={15} />
                {t.player.desktopLyrics}
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/80 transition-transform hover:bg-white/15 active:scale-95"
              >
                <CaretDown size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Main Split Content */}
          <div className="relative z-10 grid flex-1 grid-cols-12 gap-5 lg:gap-8 overflow-hidden px-6 lg:px-10 pb-6 lg:pb-10 pt-2">
            {/* Left Artwork + Playback Column */}
            <div className="col-span-5 flex flex-col items-center justify-center pr-2 lg:pr-4">
              <motion.div
                key={currentTrack.id}
                initial={{ scale: 0.93, opacity: 0 }}
                animate={{ scale: isPlaying ? 1 : 0.96, opacity: 1 }}
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                className="aspect-square w-full max-w-[230px] lg:max-w-[340px] max-h-[34vh] lg:max-h-[45vh] overflow-hidden rounded-[26px] ring-1 ring-white/15"
                style={{
                  boxShadow: `0 32px 90px -18px ${accent}`,
                }}
              >
                <CoverArt
                  src={currentTrack.coverUrl}
                  title={currentTrack.title}
                  artist={currentTrack.artist}
                  className="aspect-square w-full h-full"
                  iconSize={64}
                  loading="eager"
                />
              </motion.div>

              <div className="mt-4 lg:mt-6 w-full max-w-[340px]">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-[19px] lg:text-[22px] font-bold tracking-tight text-white">
                      {currentTrack.title}
                    </h2>
                    <p className="mt-0.5 truncate text-[13.5px] lg:text-[15px] text-white/60">
                      {currentTrack.artist}
                    </p>
                  </div>
                  <FrequencyVisualizer bars={18} width={86} height={26} />
                </div>

                <div className="mt-3.5 lg:mt-5">
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      audioEngine.seek(ratio * durationMs);
                    }}
                    className="group relative h-2 w-full cursor-pointer rounded-full bg-white/15"
                  >
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-75"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[11.5px] text-white/50 tabular-nums">
                    <span>{formatMs(currentTimeMs)}</span>
                    <span>{formatMs(durationMs || currentTrack.duration * 1000)}</span>
                  </div>
                </div>

                <div className="mt-3 lg:mt-4 flex items-center justify-center gap-6">
                  <button
                    type="button"
                    onClick={() => void prevTrack()}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/75 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                  >
                    <SkipBack size={22} weight="fill" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void togglePlayPause()}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform duration-200 hover:scale-105 active:scale-95"
                  >
                    {isPlaying ? (
                      <Pause size={24} weight="fill" />
                    ) : (
                      <Play size={24} weight="fill" className="ml-0.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void nextTrack(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/75 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                  >
                    <SkipForward size={22} weight="fill" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Spring Lyrics Column */}
            <div className="relative col-span-7 flex flex-col overflow-hidden">
              {lyricsLoading ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/60">
                  <SpinnerGap size={30} className="animate-spin" />
                  <p className="text-[14px]">{t.lyrics.searching}</p>
                </div>
              ) : lyricsPayload?.synced && lines.length > 0 ? (
                <>
                  <div
                    ref={containerRef}
                    onWheel={handleUserWheel}
                    onTouchStart={handleUserWheel}
                    style={{
                      maskImage:
                        'linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%)',
                      WebkitMaskImage:
                        'linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%)',
                    }}
                    className="relative flex-1 overflow-y-auto px-6 py-[24vh] scroll-auto"
                  >
                    <div className="space-y-6">
                      {lines.map((line, idx) => {
                        const isActive = idx === activeIndex;
                        const dist = activeIndex >= 0 ? Math.abs(idx - activeIndex) : 0;
                        const blurPx = manualScroll
                          ? 0
                          : dist === 0
                            ? 0
                            : dist === 1
                              ? 0.55
                              : dist === 2
                                ? 1.4
                                : 2.3;
                        const opacity = manualScroll
                          ? isActive
                            ? 1
                            : 0.72
                          : isActive
                            ? 1
                            : dist === 1
                              ? 0.52
                              : dist === 2
                                ? 0.3
                                : 0.16;

                        const staggerDelay = manualScroll ? 0 : Math.min(dist * 0.015, 0.08);

                        return (
                          <motion.div
                            key={`${line.timeMs}_${idx}`}
                            animate={{
                              scale: isActive ? 1.03 : 0.985,
                              opacity,
                              filter: `blur(${blurPx}px)`,
                            }}
                            whileHover={{
                              opacity: 0.98,
                              filter: 'blur(0px)',
                              scale: isActive ? 1.035 : 1.01,
                            }}
                            transition={{
                              duration: 0.4,
                              delay: staggerDelay,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="group relative flex w-full origin-left items-center justify-between gap-3 rounded-2xl px-4 py-2 transition-colors hover:bg-white/[0.045]"
                          >
                            <button
                              ref={(el) => {
                                lineRefs.current[idx] = el;
                              }}
                              type="button"
                              onClick={() => handleSeekToLine(line.timeMs)}
                              className="flex-1 text-left"
                            >
                              <span
                                className={cn(
                                  'text-[21px] lg:text-[26px] xl:text-[30px] font-bold leading-[1.42] tracking-tight transition-colors duration-300',
                                  isActive ? 'text-white' : 'text-white/85'
                                )}
                                style={
                                  isActive
                                    ? { textShadow: `0 4px 28px ${accent}` }
                                    : undefined
                                }
                              >
                                {line.text}
                              </span>
                            </button>

                            <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleSyncLineToNow(line.timeMs)}
                                title={t.lyrics.syncHere}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-cyan-200 hover:bg-cyan-400/25"
                              >
                                <Crosshair size={13} />
                              </button>
                              <span className="font-mono text-[11px] text-white/45 tabular-nums">
                                {formatMs(line.timeMs)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <AnimatePresence>
                    {manualScroll && (
                      <motion.button
                        initial={{ opacity: 0, y: 12, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.94 }}
                        type="button"
                        onClick={handleResync}
                        className="absolute bottom-6 right-8 flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-4 py-2 text-[13px] font-semibold text-white shadow-xl backdrop-blur-xl hover:bg-white/20"
                      >
                        <ArrowsClockwise size={15} weight="bold" />
                        {t.lyrics.resync}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </>
              ) : lyricsPayload?.plainText ? (
                <div className="flex-1 overflow-y-auto px-8 py-8">
                  <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11.5px] text-white/60">
                    {t.lyrics.unsyncedTag}
                  </span>
                  <div className="mt-6 whitespace-pre-line text-[22px] font-semibold leading-[1.8] text-white/85">
                    {lyricsPayload.plainText}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/45">
                  <MusicNote size={44} weight="light" />
                  <p className="text-[16px] font-medium">{t.lyrics.instrumental}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
