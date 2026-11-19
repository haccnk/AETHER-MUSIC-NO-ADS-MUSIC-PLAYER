import React from 'react';
import {
  ArrowClockwise,
  CheckCircle,
  DownloadSimple,
  FolderOpen,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../store/usePlayerStore';
import { CoverArt } from '../components/ui/CoverArt';
import { cn } from '../utils/format';

export const DownloadsView: React.FC = () => {
  const downloads = usePlayerStore((s) => s.downloads);
  const settings = usePlayerStore((s) => s.settings);
  const cancelDownload = usePlayerStore((s) => s.cancelDownload);
  const retryDownload = usePlayerStore((s) => s.retryDownload);
  const clearCompletedDownloads = usePlayerStore((s) => s.clearCompletedDownloads);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const setView = usePlayerStore((s) => s.setView);
  const t = usePlayerStore((s) => s.t());

  const activeCount = downloads.filter(
    (d) =>
      d.status === 'queued' ||
      d.status === 'resolving' ||
      d.status === 'downloading' ||
      d.status === 'tagging'
  ).length;

  return (
    <div className="space-y-6 pb-36">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-extrabold tracking-tight text-white">
              {t.downloads.title}
            </h1>
            {activeCount > 0 && (
              <span className="rounded-full border border-cyan-400/35 bg-cyan-400/15 px-3 py-0.5 font-mono text-[12px] font-semibold text-cyan-200">
                {t.downloads.activeCount.replace('{count}', String(activeCount))}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13.5px] text-white/55">{t.downloads.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void window.aetherAPI?.openFolder(settings.downloadDir)}
            className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-[12.5px] font-semibold text-white/85 hover:bg-white/12"
          >
            <FolderOpen size={15} />
            {t.downloads.openDownloadDir}
          </button>

          {downloads.length > 0 && (
            <button
              type="button"
              onClick={() => void clearCompletedDownloads()}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-[12.5px] font-semibold text-white/75 hover:bg-white/12 hover:text-white"
            >
              <Trash size={15} />
              {t.downloads.clearDone}
            </button>
          )}
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.02] px-6 text-center text-white/45">
          <DownloadSimple size={38} weight="light" />
          <p className="max-w-md text-[14px]">{t.downloads.empty}</p>
        </div>
      ) : (
        <div className="bezel-outer">
          <div className="bezel-inner space-y-2.5 p-4">
            {downloads.map((task) => {
              const isBusy =
                task.status === 'queued' ||
                task.status === 'resolving' ||
                task.status === 'downloading' ||
                task.status === 'tagging';
              const isCookieReadError =
                task.status === 'failed' &&
                Boolean(
                  task.error &&
                    /could not copy .* cookie database|database is locked|failed to decrypt with dpapi|app-bound/i.test(
                      task.error
                    )
                );
              const isBotAuthError =
                !isCookieReadError &&
                task.status === 'failed' &&
                Boolean(
                  task.error &&
                    /sign in to confirm you're not a bot|cookies-from-browser|--cookies/i.test(
                      task.error
                    )
                );
              const showAuthShortcut = isCookieReadError || isBotAuthError;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
                >
                  <div
                    onClick={() =>
                      task.status === 'completed' && void playTrack(task.track, [task.track])
                    }
                    className={cn(
                      'h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10',
                      task.status === 'completed' && 'cursor-pointer'
                    )}
                  >
                    <CoverArt
                      src={task.track.coverUrl}
                      title={task.track.title}
                      artist={task.track.artist}
                      className="h-full w-full"
                      iconSize={20}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[14px] font-semibold text-white">
                        {task.track.title}
                      </p>
                      <span className="shrink-0 font-mono text-[12px] text-white/65 tabular-nums">
                        {task.speed ? `${task.speed} • ` : ''}
                        {task.progress}%
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-white/55">
                      <span className="truncate">{task.track.artist}</span>
                      <span>•</span>
                      <span className="truncate text-white/45">
                        {task.albumTitle || task.track.album}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-200',
                          task.status === 'completed'
                            ? 'bg-emerald-400'
                            : task.status === 'failed'
                              ? 'bg-rose-400'
                              : task.status === 'cancelled'
                                ? 'bg-white/30'
                                : 'bg-gradient-to-r from-violet-400 to-cyan-300'
                        )}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px]">
                      {task.status === 'completed' && (
                        <CheckCircle size={14} weight="fill" className="shrink-0 text-emerald-400" />
                      )}
                      {task.status === 'failed' && (
                        <WarningCircle size={14} weight="fill" className="shrink-0 text-rose-400" />
                      )}
                      <span
                        className={cn(
                          task.status === 'completed'
                            ? 'text-emerald-300'
                            : task.status === 'failed'
                              ? 'text-rose-300'
                              : 'text-white/55'
                        )}
                      >
                        {t.downloads.status[task.status]}
                        {task.error
                          ? `: ${
                              isCookieReadError
                                ? t.downloads.cookieReadError
                                : isBotAuthError
                                  ? t.downloads.botAuthRequired
                                  : task.error
                            }`
                          : ''}
                      </span>
                      {showAuthShortcut && (
                        <button
                          type="button"
                          onClick={() => setView('settings')}
                          className="rounded-full border border-amber-400/35 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/25"
                        >
                          {t.downloads.openAuthSettings}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isBusy && (
                      <button
                        type="button"
                        onClick={() => void cancelDownload(task.id)}
                        title={t.downloads.cancel}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-rose-500/20 hover:text-rose-200"
                      >
                        <X size={14} />
                      </button>
                    )}

                    {(task.status === 'failed' || task.status === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => void retryDownload(task.id)}
                        title={t.downloads.retry}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 hover:bg-white/15 hover:text-white"
                      >
                        <ArrowClockwise size={14} />
                      </button>
                    )}

                    {task.status === 'completed' && task.outputPath && (
                      <button
                        type="button"
                        onClick={() => void window.aetherAPI?.revealFile(task.outputPath!)}
                        title={t.downloads.reveal}
                        className="flex h-8 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 text-[11.5px] font-medium text-white/80 hover:bg-white/15"
                      >
                        <FolderOpen size={13} />
                        {t.downloads.reveal}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
