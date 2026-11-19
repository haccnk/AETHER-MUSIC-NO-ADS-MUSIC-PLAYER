import React, { useEffect, useRef, useState } from 'react';
import {
  Desktop,
  DownloadSimple,
  Globe,
  LockOpen,
  MagnifyingGlass,
  Minus,
  Square,
  X,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { cn } from '../../utils/format';

export const Titlebar: React.FC = () => {
  const searchQuery = usePlayerStore((s) => s.searchQuery);
  const setSearchQuery = usePlayerStore((s) => s.setSearchQuery);
  const setView = usePlayerStore((s) => s.setView);
  const settings = usePlayerStore((s) => s.settings);
  const updateSettings = usePlayerStore((s) => s.updateSettings);
  const downloads = usePlayerStore((s) => s.downloads);
  const isDesktopLyricsOpen = usePlayerStore((s) => s.isDesktopLyricsOpen);
  const toggleDesktopLyrics = usePlayerStore((s) => s.toggleDesktopLyrics);
  const t = usePlayerStore((s) => s.t());

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const activeDownloads = downloads.filter(
    (d) =>
      d.status === 'queued' ||
      d.status === 'resolving' ||
      d.status === 'downloading' ||
      d.status === 'tagging'
  ).length;

  useEffect(() => {
    const off = window.aetherAPI?.onWindowMaximized((max) => setIsMaximized(max));
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      off?.();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = searchQuery.trim();
    if (!val) return;
    if (/^https?:\/\//i.test(val) || /^spotify:/i.test(val)) {
      setView('batch-url');
    } else {
      setView('search');
    }
  };

  return (
    <header className="app-drag relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/25 px-5 backdrop-blur-2xl">
      {/* Left Brand */}
      <div className="app-no-drag flex items-center gap-3">
        <div
          onClick={() => setView('discover')}
          className="flex cursor-pointer items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-violet-500/35 to-cyan-400/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            <div className="flex items-end gap-[2px] h-3.5">
              <span className="w-[2px] h-2 rounded-full bg-white" />
              <span className="w-[2px] h-3.5 rounded-full bg-white" />
              <span className="w-[2px] h-2.5 rounded-full bg-white" />
            </div>
          </div>
          <span className="text-[14.5px] font-bold tracking-tight text-white">
            {t.appName}
          </span>
        </div>
      </div>

      {/* Center Search Bar */}
      <form
        onSubmit={handleSubmit}
        className="app-no-drag mx-4 flex w-full max-w-[480px] items-center gap-2.5 rounded-full border border-white/[0.11] bg-white/[0.055] px-4 py-1.5 transition-colors focus-within:border-white/30 focus-within:bg-white/[0.09]"
      >
        <MagnifyingGlass size={15} className="shrink-0 text-white/50" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.search.placeholder}
          className="w-full bg-transparent text-[13px] text-white placeholder-white/40 outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-white/45 hover:text-white"
          >
            <X size={13} />
          </button>
        )}
        <kbd className="hidden md:inline-block shrink-0 whitespace-nowrap rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40">
          Ctrl K
        </kbd>
      </form>

      {/* Right Utility Pills & Window Controls */}
      <div className="app-no-drag flex items-center gap-2">
        {isDesktopLyricsOpen && settings.desktopLyricsLocked && (
          <button
            type="button"
            onClick={() => void window.aetherAPI?.setDesktopLyricsLock(false)}
            className="flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/15 px-3 py-1 text-[11.5px] font-medium text-amber-200 hover:bg-amber-400/25"
          >
            <LockOpen size={13} />
            {t.lyrics.unlockClickThrough}
          </button>
        )}

        <button
          type="button"
          onClick={() => void toggleDesktopLyrics()}
          title={t.player.desktopLyrics}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors',
            isDesktopLyricsOpen
              ? 'border-cyan-400/35 bg-cyan-400/15 text-cyan-200'
              : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10 hover:text-white'
          )}
        >
          <Desktop size={14} />
        </button>

        {activeDownloads > 0 && (
          <button
            type="button"
            onClick={() => setView('downloads')}
            className="flex h-8 items-center gap-1.5 rounded-full border border-cyan-400/35 bg-cyan-400/15 px-3 text-[11.5px] font-semibold text-cyan-200"
          >
            <DownloadSimple size={14} weight="bold" className="animate-bounce" />
            <span className="font-mono tabular-nums">{activeDownloads}</span>
          </button>
        )}

        {/* Language Toggle VI / EN */}
        <button
          type="button"
          onClick={() =>
            void updateSettings({ language: settings.language === 'vi' ? 'en' : 'vi' })
          }
          className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[11.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Globe size={14} />
          {settings.language.toUpperCase()}
        </button>

        <div className="mx-1 h-4 w-px bg-white/10" />

        {/* Native Window Controls */}
        <button
          type="button"
          onClick={() => void window.aetherAPI?.minimizeWindow()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={async () => {
            const max = await window.aetherAPI?.maximizeWindow();
            if (typeof max === 'boolean') setIsMaximized(max);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Square size={12} weight={isMaximized ? 'fill' : 'regular'} />
        </button>
        <button
          type="button"
          onClick={() => void window.aetherAPI?.closeWindow()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-rose-500/80 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};
