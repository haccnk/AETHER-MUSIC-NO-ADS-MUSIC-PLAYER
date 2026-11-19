import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CaretUp,
  Lock,
  LockOpen,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  TextAa,
  X,
} from '@phosphor-icons/react';
import { DesktopIslandBounds, DesktopLyricsSyncPayload } from '../../types/music';
import { translations } from '../../i18n/translations';
import { usePlayerStore } from '../../store/usePlayerStore';
import { CoverArt } from '../ui/CoverArt';
import { cn } from '../../utils/format';

const COLLAPSED_BOUNDS: DesktopIslandBounds = {
  x: 158,
  y: 42,
  width: 444,
  height: 54,
  radius: 27,
};
const EXPANDED_BOUNDS: DesktopIslandBounds = {
  x: 26,
  y: 40,
  width: 708,
  height: 176,
  radius: 40,
};

interface RadialDiscWaveProps {
  spectrum: number[];
  isPlaying: boolean;
  accentColor: string;
  active: boolean;
}

function toRgba(color: string, alpha: number): string {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (m) {
    return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
  }
  return `rgba(56, 189, 248, ${alpha})`;
}

const RadialDiscWave: React.FC<RadialDiscWaveProps> = ({
  spectrum,
  isPlaying,
  accentColor,
  active,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const specRef = useRef<number[]>(spectrum);
  const playingRef = useRef<boolean>(isPlaying);
  const accentRef = useRef<string>(accentColor);
  const smoothedRef = useRef<Float32Array>(new Float32Array(40));

  specRef.current = spectrum;
  playingRef.current = isPlaying;
  accentRef.current = accentColor;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 142;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let rafId = 0;
    let phase = 0;

    const draw = () => {
      phase += playingRef.current ? 0.045 : 0.012;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const baseR = 44;
      const barCount = 40;
      const smooth = smoothedRef.current;
      const raw = specRef.current;
      const accent = accentRef.current;

      // Ambient halo ring around the disc
      ctx.beginPath();
      ctx.arc(cx, cy, baseR - 1, 0, Math.PI * 2);
      ctx.strokeStyle = toRgba(accent, playingRef.current ? 0.35 : 0.14);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Smooth undulating circular sound-wave spline behind bars
      ctx.beginPath();
      for (let i = 0; i <= barCount; i++) {
        const idx = i % barCount;
        // Symmetrical mirror across left/right halves for balanced halo look
        const mirrorIdx = idx <= barCount / 2 ? idx : barCount - idx;
        const binPos = (mirrorIdx / (barCount / 2)) * Math.max(1, raw.length - 1);
        const low = Math.floor(binPos);
        const rawSample = raw.length > 0 ? (raw[Math.min(raw.length - 1, low)] ?? 0) : 0;

        // Subtle organic idle motion while playing even in quiet passages
        const shimmer = playingRef.current
          ? 0.08 + Math.sin(phase * 1.9 + idx * 0.45) * 0.05
          : 0.025;
        const target = playingRef.current ? Math.max(rawSample, shimmer) : 0.03;

        smooth[idx] += (target - smooth[idx]) * 0.24;

        const angle = (idx / barCount) * Math.PI * 2 - Math.PI / 2;
        const rWave = baseR + 2 + smooth[idx] * 17;
        const px = cx + Math.cos(angle) * rWave;
        const py = cy + Math.sin(angle) * rWave;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = toRgba(accent, playingRef.current ? 0.42 : 0.16);
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // Crisp radial sound-wave bars orbiting the vinyl disc
      ctx.lineCap = 'round';
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const energy = smooth[i];
        const barLen = 2.5 + energy * 17.5;
        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + barLen);
        const y2 = cy + Math.sin(angle) * (baseR + barLen);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = toRgba(
          accent,
          playingRef.current ? 0.35 + energy * 0.65 : 0.18
        );
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 142, height: 142 }}
      className="pointer-events-none block"
    />
  );
};

export const DesktopLyricsApp: React.FC = () => {
  const [payload, setPayload] = useState<DesktopLyricsSyncPayload>({
    trackTitle: 'Aether Music',
    artist: 'Dynamic Island',
    coverUrl: '',
    currentLine: '♪ Aether Music',
    nextLine: '',
    lineProgress: 0,
    isPlaying: false,
    accentColor: 'rgba(56, 189, 248, 0.95)',
    locked: false,
    language: 'vi',
    spectrum: [],
  });
  const [expanded, setExpanded] = useState(false);
  const [fontScale, setFontScale] = useState(1);

  const draggingRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('desktop-lyrics-win');
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.title = '';

    window.aetherAPI?.setDesktopIslandBounds(COLLAPSED_BOUNDS);
    void window.aetherAPI?.getMediaPort().then((port) => {
      if (port) usePlayerStore.setState({ mediaPort: port });
    });
    void window.aetherAPI?.getInitialDesktopLyrics().then((initial) => {
      if (initial) setPayload(initial);
    });

    const offSync = window.aetherAPI?.onDesktopLyricsSync((next) => {
      setPayload(next);
    });
    const offLock = window.aetherAPI?.onDesktopLyricsLockState((locked) => {
      setPayload((prev) => ({ ...prev, locked }));
    });

    return () => {
      offSync?.();
      offLock?.();
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (expanded) {
      window.aetherAPI?.setDesktopIslandBounds(EXPANDED_BOUNDS);
    } else {
      collapseTimerRef.current = setTimeout(() => {
        window.aetherAPI?.setDesktopIslandBounds(COLLAPSED_BOUNDS);
      }, 360);
    }
  }, [expanded]);

  const t = translations[payload.language] ?? translations.vi;
  const sendCmd = (cmd: 'play-pause' | 'next' | 'prev' | 'unlock' | 'close') => {
    window.aetherAPI?.sendDesktopLyricsCommand(cmd);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (payload.locked || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = {
      startX: e.screenX,
      startY: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const totalMove = Math.hypot(e.screenX - drag.startX, e.screenY - drag.startY);
    if (totalMove >= 5) {
      drag.moved = true;
    }
    if (drag.moved) {
      const dx = e.screenX - drag.lastX;
      const dy = e.screenY - drag.lastY;
      if (dx !== 0 || dy !== 0) {
        drag.lastX = e.screenX;
        drag.lastY = e.screenY;
        window.aetherAPI?.moveDesktopLyricsBy(dx, dy);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    draggingRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore release failure
    }
    if (drag && !drag.moved && !expanded && !payload.locked) {
      setExpanded(true);
    }
  };

  const spectrum = payload.spectrum ?? [];
  const miniBars = [0, 3, 7, 11, 16, 21];

  return (
    <div className="flex h-screen w-screen items-start justify-center pt-[44px] select-none overflow-hidden">
      <motion.div
        initial={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        animate={{
          width: expanded ? 700 : 440,
          height: expanded ? 168 : 50,
          borderRadius: expanded ? 36 : 25,
        }}
        transition={{
          duration: expanded ? 0.38 : 0.32,
          ease: [0.32, 0.72, 0, 1],
        }}
        style={{
          background: expanded
            ? `radial-gradient(150px circle at 89px 84px, ${toRgba(payload.accentColor, 0.22)}, rgba(6, 7, 12, 0.98) 78%), #06070C`
            : `radial-gradient(90px circle at 28px 25px, ${toRgba(payload.accentColor, 0.18)}, rgba(6, 7, 12, 0.98) 80%), #06070C`,
          boxShadow:
            'inset 0 0 0 1px rgba(255, 255, 255, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        }}
        className={cn(
          'relative overflow-hidden',
          !payload.locked && (expanded ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')
        )}
      >
        {/* Fixed-width Collapsed Layer (fades cleanly without reflowing) */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 z-10 flex justify-center',
            expanded && 'pointer-events-none'
          )}
        >
          <motion.div
            initial={false}
            animate={{
              opacity: expanded ? 0 : 1,
              scale: expanded ? 0.94 : 1,
            }}
            transition={{
              duration: expanded ? 0.16 : 0.24,
              delay: expanded ? 0 : 0.1,
              ease: [0.32, 0.72, 0, 1],
            }}
            className="flex h-[50px] w-[440px] shrink-0 items-center justify-between gap-3 px-2.5"
          >
          {/* Left Mini Spinning Vinyl Disc */}
          <div className="relative flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[#11131C] p-[2.5px] ring-1 ring-white/15 shadow-md">
            <div
              style={{ animationPlayState: payload.isPlaying ? 'running' : 'paused' }}
              className="vinyl-disc-spin relative h-full w-full overflow-hidden rounded-full"
            >
              <CoverArt
                src={payload.coverUrl}
                title={payload.trackTitle}
                artist={payload.artist}
                className="h-full w-full rounded-full"
                iconSize={15}
                loading="eager"
              />
              <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45 bg-[#06070C]" />
            </div>
          </div>

          {/* Center Current Lyric Line */}
          <div className="min-w-0 flex-1 text-center">
            <motion.p
              key={payload.currentLine}
              initial={{ opacity: 0.45, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="truncate text-[13.5px] font-semibold tracking-tight text-white"
            >
              {payload.currentLine || payload.trackTitle}
            </motion.p>
          </div>

          {/* Right Mini Sound Wave */}
          <div className="flex h-5 shrink-0 items-center gap-[3px] pr-2">
            {miniBars.map((bin, idx) => {
              const energy = spectrum[bin] ?? 0;
              const pct = payload.isPlaying
                ? Math.max(22, Math.min(100, Math.round(24 + energy * 76)))
                : 22;
              return (
                <span
                  key={idx}
                  style={{
                    height: `${pct}%`,
                    backgroundColor:
                      idx % 2 === 0 ? payload.accentColor : 'rgba(255, 255, 255, 0.85)',
                  }}
                  className="w-[2.5px] rounded-full transition-[height] duration-75"
                />
              );
            })}
            {payload.locked && <Lock size={11} className="ml-1 text-white/45" />}
          </div>
          </motion.div>
        </div>

        {/* Fixed-width Expanded Layer: Strict 2-Column Grid — Zero Reflow, Zero Overlap */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 z-10 flex justify-center',
            !expanded && 'pointer-events-none'
          )}
        >
          <motion.div
            initial={false}
            animate={{
              opacity: expanded ? 1 : 0,
              scale: expanded ? 1 : 0.96,
            }}
            transition={{
              duration: expanded ? 0.24 : 0.16,
              delay: expanded ? 0.12 : 0,
              ease: [0.32, 0.72, 0, 1],
            }}
            className="grid h-[168px] w-[700px] shrink-0 grid-cols-[146px_minmax(0,1fr)] items-center gap-4 px-4 py-3 overflow-hidden"
          >
          {/* Column 1: Spinning Vinyl Disc surrounded by Radial Sound Waves */}
          <div className="relative flex h-[142px] w-[142px] shrink-0 items-center justify-center overflow-hidden">
            <RadialDiscWave
              spectrum={spectrum}
              isPlaying={payload.isPlaying}
              accentColor={payload.accentColor}
              active={expanded}
            />

            {/* Dark Vinyl Grooves + Spinning Album Disc */}
            <div className="pointer-events-none absolute flex h-[82px] w-[82px] items-center justify-center rounded-full bg-gradient-to-br from-[#1B1F2E] via-[#090B12] to-[#151824] p-[7px] ring-1 ring-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.85)]">
              <div className="pointer-events-none absolute inset-[3px] rounded-full border border-white/[0.06]" />
              <div
                style={{ animationPlayState: payload.isPlaying ? 'running' : 'paused' }}
                className="vinyl-disc-spin relative h-full w-full overflow-hidden rounded-full ring-1 ring-black/60"
              >
                <CoverArt
                  src={payload.coverUrl}
                  title={payload.trackTitle}
                  artist={payload.artist}
                  className="h-full w-full rounded-full"
                  iconSize={26}
                  loading="eager"
                />
              </div>
              <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/55 bg-[#06070C] shadow-inner" />
            </div>
          </div>

          {/* Column 2: Metadata + Controls (top), Synced Lyrics (middle), Progress Bar (bottom) */}
          <div className="flex h-full min-w-0 flex-col justify-between overflow-hidden py-0.5 pr-1">
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white leading-tight">
                  {payload.trackTitle}
                </p>
                <p className="truncate text-[11px] text-white/55 leading-tight mt-0.5">
                  {payload.artist}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.06] px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => sendCmd('prev')}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white"
                >
                  <SkipBack size={12} weight="fill" />
                </button>
                <button
                  type="button"
                  onClick={() => sendCmd('play-pause')}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
                >
                  {payload.isPlaying ? (
                    <Pause size={11} weight="fill" />
                  ) : (
                    <Play size={11} weight="fill" className="ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => sendCmd('next')}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white"
                >
                  <SkipForward size={12} weight="fill" />
                </button>

                <div className="mx-0.5 h-3.5 w-px bg-white/15" />

                <button
                  type="button"
                  onClick={() =>
                    setFontScale((s) => (s >= 1.2 ? 0.88 : Number((s + 0.1).toFixed(2))))
                  }
                  title="Font size"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white"
                >
                  <TextAa size={12} />
                </button>

                <button
                  type="button"
                  title={t.lyrics.lockClickThrough}
                  onClick={() => void window.aetherAPI?.setDesktopLyricsLock(true)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white"
                >
                  <LockOpen size={12} />
                </button>

                <button
                  type="button"
                  title={payload.language === 'vi' ? 'Thu gọn đảo' : 'Collapse island'}
                  onClick={() => setExpanded(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
                >
                  <CaretUp size={13} weight="bold" />
                </button>

                <button
                  type="button"
                  title={t.lyrics.closeOverlay}
                  onClick={() => sendCmd('close')}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/65 hover:bg-rose-500/25 hover:text-rose-200"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="my-auto flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden">
              <motion.p
                key={payload.currentLine}
                initial={{ opacity: 0.35, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                style={{
                  fontSize: `${Math.round(18.5 * fontScale)}px`,
                  textShadow: `0 0 18px ${toRgba(payload.accentColor, 0.45)}`,
                }}
                className="line-clamp-2 font-bold leading-[1.3] tracking-tight text-white"
              >
                {payload.currentLine || payload.trackTitle}
              </motion.p>

              <p
                style={{ fontSize: `${Math.round(13 * fontScale)}px` }}
                className="truncate font-medium text-white/55"
              >
                {payload.nextLine || `${payload.trackTitle} — ${payload.artist}`}
              </p>
            </div>

            <div className="h-[2.5px] w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${Math.round(payload.lineProgress * 100)}%`,
                  backgroundColor: payload.accentColor,
                }}
              />
            </div>
          </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
