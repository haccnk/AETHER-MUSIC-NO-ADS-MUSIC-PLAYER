import React from 'react';
import { Reorder } from 'framer-motion';
import {
  ArrowUp,
  DotsSixVertical,
  Shuffle,
  Trash,
  X,
} from '@phosphor-icons/react';
import { Track } from '../../types/music';
import { usePlayerStore } from '../../store/usePlayerStore';
import { CoverArt } from '../ui/CoverArt';
import { formatDuration } from '../../utils/format';

const itemKeyMap = new WeakMap<Track, string>();
let keyCounter = 0;

function getTrackKey(track: Track): string {
  let k = itemKeyMap.get(track);
  if (!k) {
    keyCounter++;
    k = `${track.id}_${keyCounter}`;
    itemKeyMap.set(track, k);
  }
  return k;
}

export const QueueEditorList: React.FC = () => {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const priorityQueue = usePlayerStore((s) => s.priorityQueue);
  const contextQueue = usePlayerStore((s) => s.contextQueue);
  const contextIndex = usePlayerStore((s) => s.contextIndex);
  const contextName = usePlayerStore((s) => s.contextName);
  const shuffle = usePlayerStore((s) => s.shuffle);

  const reorderPriorityQueue = usePlayerStore((s) => s.reorderPriorityQueue);
  const removeFromPriorityQueue = usePlayerStore((s) => s.removeFromPriorityQueue);
  const clearPriorityQueue = usePlayerStore((s) => s.clearPriorityQueue);
  const reorderUpcomingContext = usePlayerStore((s) => s.reorderUpcomingContext);
  const removeFromUpcomingContext = usePlayerStore((s) => s.removeFromUpcomingContext);
  const jumpToQueueItem = usePlayerStore((s) => s.jumpToQueueItem);
  const playNextInQueue = usePlayerStore((s) => s.playNextInQueue);
  const t = usePlayerStore((s) => s.t());

  const upcomingContext = contextIndex >= 0 ? contextQueue.slice(contextIndex + 1) : contextQueue;

  return (
    <div className="space-y-5">
      {/* Now Playing */}
      {currentTrack && (
        <div>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {t.queue.nowPlaying}
          </p>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] p-2.5">
            <CoverArt
              src={currentTrack.coverUrl}
              title={currentTrack.title}
              artist={currentTrack.artist}
              className="h-10 w-10 shrink-0 rounded-xl"
              iconSize={16}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {currentTrack.title}
              </p>
              <p className="truncate text-[11.5px] text-white/55">{currentTrack.artist}</p>
            </div>
            <div className="flex items-end gap-[2px] h-3 mr-1">
              <span className="w-[2px] rounded-full bg-emerald-400 animate-[pulse_0.8s_ease-in-out_infinite] h-3" />
              <span className="w-[2px] rounded-full bg-emerald-400 animate-[pulse_0.6s_ease-in-out_infinite_0.2s] h-2" />
              <span className="w-[2px] rounded-full bg-emerald-400 animate-[pulse_0.9s_ease-in-out_infinite_0.4s] h-3" />
            </div>
          </div>
        </div>
      )}

      {/* Priority Queue ("Next in Queue") */}
      {priorityQueue.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300/85">
              {t.queue.nextInQueue} ({priorityQueue.length})
            </span>
            <button
              type="button"
              onClick={clearPriorityQueue}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white/55 hover:bg-white/10 hover:text-white"
            >
              <Trash size={11} />
              {t.queue.clearQueue}
            </button>
          </div>

          <Reorder.Group
            axis="y"
            values={priorityQueue}
            onReorder={reorderPriorityQueue}
            className="space-y-1"
          >
            {priorityQueue.map((tr, i) => (
              <Reorder.Item
                key={getTrackKey(tr)}
                value={tr}
                className="group flex items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-2 py-1.5 hover:bg-cyan-400/[0.12]"
              >
                <span className="cursor-grab text-white/35 hover:text-white/75 active:cursor-grabbing">
                  <DotsSixVertical size={14} />
                </span>
                <button
                  type="button"
                  onClick={() => void jumpToQueueItem('priority', i)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <CoverArt
                    src={tr.coverUrl}
                    title={tr.title}
                    artist={tr.artist}
                    className="h-8 w-8 shrink-0 rounded-lg"
                    iconSize={13}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-white/95">
                      {tr.title}
                    </p>
                    <p className="truncate text-[11px] text-white/55">{tr.artist}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeFromPriorityQueue(i)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/35 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/15 hover:text-white"
                >
                  <X size={12} />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      )}

      {/* Context Queue ("Next from Album / Playlist") */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            {t.queue.nextFrom.replace('{name}', contextName || t.nav.discover)}
          </span>
          {shuffle && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
              <Shuffle size={10} />
              {t.queue.shuffleOn}
            </span>
          )}
        </div>

        {upcomingContext.length === 0 ? (
          <p className="px-1 text-[12.5px] text-white/40">{t.queue.empty}</p>
        ) : (
          <Reorder.Group
            axis="y"
            values={upcomingContext}
            onReorder={reorderUpcomingContext}
            className="space-y-1"
          >
            {upcomingContext.map((tr, i) => (
              <Reorder.Item
                key={getTrackKey(tr)}
                value={tr}
                className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.07]"
              >
                <span className="cursor-grab text-white/25 group-hover:text-white/65 active:cursor-grabbing">
                  <DotsSixVertical size={14} />
                </span>
                <button
                  type="button"
                  onClick={() => void jumpToQueueItem('context', i)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <CoverArt
                    src={tr.coverUrl}
                    title={tr.title}
                    artist={tr.artist}
                    className="h-8 w-8 shrink-0 rounded-lg"
                    iconSize={13}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-white/90">
                      {tr.title}
                    </p>
                    <p className="truncate text-[11px] text-white/50">{tr.artist}</p>
                  </div>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="mr-1 font-mono text-[10.5px] text-white/35 tabular-nums group-hover:hidden">
                    {formatDuration(tr.duration)}
                  </span>
                  <button
                    type="button"
                    onClick={() => playNextInQueue(tr)}
                    title={t.album.playNext}
                    className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full text-white/50 hover:bg-white/15 hover:text-white"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromUpcomingContext(i)}
                    className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full text-white/50 hover:bg-white/15 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>
    </div>
  );
};
