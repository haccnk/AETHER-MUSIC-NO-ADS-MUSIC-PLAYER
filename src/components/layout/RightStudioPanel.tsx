import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsOut,
  FilmSlate,
  MusicNotes,
  Queue as QueueIcon,
  SpinnerGap,
  TextAlignLeft,
  X,
} from '@phosphor-icons/react';
import { audioEngine, usePlaybackTime } from '../../audio/AudioEngine';
import { usePlayerStore } from '../../store/usePlayerStore';
import { rgbToCss } from '../../utils/colorExtractor';
import { cn } from '../../utils/format';
import { CoverArt } from '../ui/CoverArt';
import { QueueEditorList } from '../audio/QueueEditorList';

const BASE_VOCAL_LEAD_MS = 55;

export const RightStudioPanel: React.FC = () => {
  const isOpen = usePlayerStore((s) => s.isRightPanelOpen);
  const toggleRightPanel = usePlayerStore((s) => s.toggleRightPanel);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const priorityQueue = usePlayerStore((s) => s.priorityQueue);
  const lyricsPayload = usePlayerStore((s) => s.lyricsPayload);
  const lyricsLoading = usePlayerStore((s) => s.lyricsLoading);
  const palette = usePlayerStore((s) => s.ambientPalette);
  const settings = usePlayerStore((s) => s.settings);
  const setImmersiveLyricsOpen = usePlayerStore((s) => s.setImmersiveLyricsOpen);
  const currentMv = usePlayerStore((s) => s.currentMv);
  const openMvModal = usePlayerStore((s) => s.openMvModal);
  const t = usePlayerStore((s) => s.t());

  const [tab, setTab] = useState<'lyrics' | 'queue'>('lyrics');
  const { currentTimeMs } = usePlaybackTime();

  const listRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const trackOffsetMs = currentTrack ? settings.lyricOffsets[currentTrack.id] ?? 0 : 0;
  const effectiveTimeMs =
    currentTimeMs - audioEngine.getOutputLatencyMs() + BASE_VOCAL_LEAD_MS + trackOffsetMs;
  const lines = lyricsPayload?.lines ?? [];

  const activeIndex = useMemo(() => {
    if (!lyricsPayload?.synced || lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (effectiveTimeMs >= lines[i].timeMs) idx = i;
      else break;
    }
    return idx;
  }, [effectiveTimeMs, lines, lyricsPayload?.synced]);

  useEffect(() => {
    if (tab !== 'lyrics' || activeIndex < 0) return;
    const container = listRef.current;
    const el = lineRefs.current[activeIndex];
    if (!container || !el) return;

    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const topTarget =
      eRect.top - cRect.top + container.scrollTop - cRect.height * 0.38 + eRect.height * 0.5;
    container.scrollTo({
      top: Math.max(0, topTarget),
      behavior: 'smooth',
    });
  }, [activeIndex, tab]);

  if (!isOpen) return null;

  const accentGlow = rgbToCss(palette[0], 0.4);

  return (
    <aside className="fixed right-3 top-16 bottom-28 z-20 flex w-[332px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[#0B0D14]/94 shadow-2xl backdrop-blur-2xl xl:relative xl:inset-auto xl:z-10 xl:w-[316px] 2xl:w-[336px] xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-l xl:border-white/[0.06] xl:bg-black/25 xl:shadow-none">
      {/* Top Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-3">
        <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-white/[0.05] p-0.5">
          <button
            type="button"
            onClick={() => setTab('lyrics')}
            title={t.player.lyrics}
            className={cn(
              'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold transition-colors',
              tab === 'lyrics' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
            )}
          >
            <TextAlignLeft size={13} className="shrink-0" />
            <span>{t.player.lyricsShort}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('queue')}
            title={t.queue.title}
            className={cn(
              'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold transition-colors',
              tab === 'queue' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
            )}
          >
            <QueueIcon size={13} className="shrink-0" />
            <span>{t.queue.shortTitle}</span>
            {priorityQueue.length > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none',
                  tab === 'queue' ? 'bg-black/15 text-black' : 'bg-cyan-400/20 text-cyan-200'
                )}
              >
                {priorityQueue.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {currentMv && (
            <button
              type="button"
              onClick={() => void openMvModal()}
              title={t.mv.watchMv}
              className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-cyan-400/35 bg-cyan-400/15 px-2.5 text-[11.5px] font-bold text-cyan-200 transition-colors hover:bg-cyan-400/25"
            >
              <FilmSlate size={13} weight="fill" className="shrink-0" />
              <span>{t.mv.badge}</span>
            </button>
          )}
          {currentTrack && (
            <button
              type="button"
              onClick={() => setImmersiveLyricsOpen(true)}
              title={t.player.lyrics}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              <ArrowsOut size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={toggleRightPanel}
            className="flex xl:hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!currentTrack && tab === 'lyrics' ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-white/40">
          <MusicNotes size={36} weight="light" />
          <p className="mt-3 text-[13.5px] font-medium text-white/65">
            {t.player.nothingPlaying}
          </p>
          <p className="mt-1 text-[12px]">{t.player.chooseTrack}</p>
        </div>
      ) : tab === 'queue' ? (
        <div className="flex-1 overflow-y-auto px-3.5 py-4 xl:pb-28">
          <QueueEditorList />
        </div>
      ) : (
        <>
          {/* Compact Now Playing Header Card */}
          <div className="p-4 pb-2.5">
            <div
              onClick={() => setImmersiveLyricsOpen(true)}
              className="group relative aspect-square w-full max-w-[230px] mx-auto xl:max-w-none cursor-pointer overflow-hidden rounded-[20px] ring-1 ring-white/15"
              style={{ boxShadow: `0 20px 50px -14px ${accentGlow}` }}
            >
              <CoverArt
                src={currentTrack!.coverUrl}
                title={currentTrack!.title}
                artist={currentTrack!.artist}
                className="h-full w-full"
                imgClassName="transition-transform duration-700 group-hover:scale-105"
                iconSize={48}
                loading="eager"
              />
            </div>

            <div className="mt-3 px-0.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-[15.5px] font-bold text-white">
                  {currentTrack!.title}
                </h3>
                {currentTrack!.localPath ? (
                  <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                    320K
                  </span>
                ) : currentTrack!.sourceType === 'spotify' ? (
                  <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                    SPOTIFY
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-white/60">
                {currentTrack!.artist}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-3 pb-4 xl:pb-28">
            {lyricsLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-white/50">
                <SpinnerGap size={22} className="animate-spin" />
                <p className="text-[12px]">{t.lyrics.searching}</p>
              </div>
            ) : lyricsPayload?.synced && lines.length > 0 ? (
              <div
                ref={listRef}
                style={{
                  maskImage:
                    'linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)',
                  WebkitMaskImage:
                    'linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)',
                }}
                className="h-full space-y-2.5 overflow-y-auto px-2 py-10"
              >
                {lines.map((line, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={`${line.timeMs}_${idx}`}
                      ref={(el) => {
                        lineRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => audioEngine.seek(Math.max(0, line.timeMs - trackOffsetMs))}
                      className={cn(
                        'block w-full rounded-xl px-2.5 py-1.5 text-left text-[14px] leading-[1.45] transition-all duration-300',
                        isActive
                          ? 'font-bold text-white scale-[1.02] bg-white/[0.08]'
                          : 'font-medium text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                      )}
                    >
                      {line.text}
                    </button>
                  );
                })}
              </div>
            ) : lyricsPayload?.plainText ? (
              <div className="h-full overflow-y-auto px-2 py-2 whitespace-pre-line text-[13px] leading-[1.7] text-white/70">
                {lyricsPayload.plainText}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-[12.5px] text-white/40">
                {t.lyrics.instrumental}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
