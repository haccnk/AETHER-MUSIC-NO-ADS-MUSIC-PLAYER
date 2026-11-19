import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CornersIn,
  CornersOut,
  FilmSlate,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerX,
  SpinnerGap,
  X,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { rgbToCss } from '../../utils/colorExtractor';
import { formatDuration } from '../../utils/format';

export const MvPlayerModal: React.FC = () => {
  const isOpen = usePlayerStore((s) => s.isMvOpen);
  const currentMv = usePlayerStore((s) => s.currentMv);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const mvStream = usePlayerStore((s) => s.mvStream);
  const mvLoading = usePlayerStore((s) => s.mvLoading);
  const mvError = usePlayerStore((s) => s.mvError);
  const palette = usePlayerStore((s) => s.ambientPalette);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const closeMvModal = usePlayerStore((s) => s.closeMvModal);
  const openMvModal = usePlayerStore((s) => s.openMvModal);
  const t = usePlayerStore((s) => s.t());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        closeMvModal();
      } else if (e.code === 'Space') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) void v.play();
          else v.pause();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMvModal, isOpen]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (a) {
      a.volume = volume;
      a.muted = muted;
    } else if (v) {
      v.volume = volume;
      v.muted = muted;
    }
  }, [muted, mvStream, volume]);

  useEffect(() => {
    if (!isOpen || !mvStream) {
      setPlaying(false);
      setCurTime(0);
      setDur(0);
    }
  }, [isOpen, mvStream]);

  const syncAudioToVideo = (forceSeek = false) => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a) return;
    if (forceSeek || Math.abs(a.currentTime - v.currentTime) > 0.14) {
      try {
        a.currentTime = v.currentTime;
      } catch {
        // Ignore before metadata loaded
      }
    }
  };

  const handleVideoPlay = () => {
    setPlaying(true);
    const a = audioRef.current;
    if (a) {
      syncAudioToVideo(true);
      void a.play().catch(() => {});
    }
  };

  const handleVideoPause = () => {
    setPlaying(false);
    audioRef.current?.pause();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || dur <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = ratio * dur;
    v.currentTime = target;
    if (audioRef.current) audioRef.current.currentTime = target;
    setCurTime(target);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  };

  const accent = rgbToCss(palette[0], 0.5);
  const progressPct = dur > 0 ? Math.min(100, Math.max(0, (curTime / dur) * 100)) : 0;

  return (
    <AnimatePresence>
      {isOpen && currentMv && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-40 flex flex-col bg-[#05060A]/96 backdrop-blur-3xl select-none"
        >
          <div
            className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 rounded-full opacity-25 blur-[130px]"
            style={{ backgroundColor: accent }}
          />

          {/* Top Cinema Bar */}
          <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/[0.07] bg-black/35 px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-400/15 text-cyan-200">
                <FilmSlate size={18} weight="fill" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[15px] font-bold text-white">
                    {currentMv.title || currentTrack?.title}
                  </h2>
                  <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                    {mvStream?.resolution || t.mv.qualityHd}
                  </span>
                </div>
                <p className="truncate text-[12px] text-white/55">
                  {currentMv.channel}
                  {currentMv.viewCountText ? ` • ${currentMv.viewCountText}` : ''}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                title={t.mv.fullscreen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/80 hover:bg-white/15 hover:text-white"
              >
                {isFullscreen ? <CornersIn size={16} /> : <CornersOut size={16} />}
              </button>
              <button
                type="button"
                onClick={closeMvModal}
                title={t.mv.close}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-white/85 hover:bg-rose-500/25 hover:text-rose-100"
              >
                <X size={17} weight="bold" />
              </button>
            </div>
          </div>

          {/* Main Video Viewport */}
          <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden p-4 lg:p-8">
            {mvLoading ? (
              <div className="flex flex-col items-center gap-3 text-white/75">
                <SpinnerGap size={34} className="animate-spin text-cyan-300" />
                <p className="text-[14px] font-medium">{t.mv.loading}</p>
              </div>
            ) : mvError ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-[14.5px] text-rose-200">{mvError}</p>
                <button
                  type="button"
                  onClick={() => void openMvModal()}
                  className="rounded-full bg-white px-5 py-2 text-[13px] font-bold text-black hover:scale-105"
                >
                  {t.downloads.retry}
                </button>
              </div>
            ) : mvStream ? (
              <div className="relative flex h-full w-full max-w-[1160px] items-center justify-center overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-2xl">
                <video
                  ref={videoRef}
                  src={mvStream.videoUrl}
                  muted={Boolean(mvStream.audioUrl) || muted}
                  playsInline
                  autoPlay
                  onClick={togglePlay}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDur(d);
                  }}
                  onTimeUpdate={(e) => {
                    setCurTime(e.currentTarget.currentTime);
                    syncAudioToVideo(false);
                  }}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onWaiting={() => audioRef.current?.pause()}
                  onPlaying={() => {
                    syncAudioToVideo(true);
                    if (audioRef.current && videoRef.current && !videoRef.current.paused) {
                      void audioRef.current.play().catch(() => {});
                    }
                  }}
                  onSeeked={() => syncAudioToVideo(true)}
                  className="h-full w-full cursor-pointer object-contain"
                />
                {mvStream.audioUrl && (
                  <audio ref={audioRef} src={mvStream.audioUrl} preload="auto" />
                )}
              </div>
            ) : null}
          </div>

          {/* Bottom Cinema Controls */}
          <div className="relative z-10 mx-auto mb-5 flex w-full max-w-[920px] items-center gap-4 rounded-2xl border border-white/12 bg-[#0B0D14]/88 px-5 py-3 shadow-2xl backdrop-blur-2xl">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!mvStream}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-40"
            >
              {playing ? (
                <Pause size={16} weight="fill" />
              ) : (
                <Play size={16} weight="fill" className="ml-0.5" />
              )}
            </button>

            <span className="w-11 shrink-0 text-right font-mono text-[11.5px] text-white/60 tabular-nums">
              {formatDuration(curTime)}
            </span>

            <div
              onClick={handleSeek}
              className="group relative flex h-4 flex-1 cursor-pointer items-center"
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15 transition-all group-hover:h-2">
                <div
                  className="h-full rounded-full bg-cyan-300 transition-[width] duration-75"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <span className="w-11 shrink-0 font-mono text-[11.5px] text-white/60 tabular-nums">
              {formatDuration(dur || currentMv.duration)}
            </span>

            <div className="flex shrink-0 items-center gap-1.5 pl-1">
              <button
                type="button"
                onClick={() => setVolume(volume, !muted)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:text-white"
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
                className="aether-range w-24 shrink-0"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
