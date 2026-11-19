import React from 'react';
import {
  Compass,
  DownloadSimple,
  FolderSimple,
  GearSix,
  LinkSimple,
  MagnifyingGlass,
  Plus,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { ActiveView } from '../../types/music';
import { cn } from '../../utils/format';
import { PlaylistCoverMosaic } from '../ui/PlaylistCoverMosaic';

export const Sidebar: React.FC = () => {
  const activeView = usePlayerStore((s) => s.activeView);
  const setView = usePlayerStore((s) => s.setView);
  const playlists = usePlayerStore((s) => s.playlists);
  const selectedPlaylistId = usePlayerStore((s) => s.selectedPlaylistId);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const openCreatePlaylistModal = usePlayerStore((s) => s.openCreatePlaylistModal);
  const downloads = usePlayerStore((s) => s.downloads);
  const favorites = usePlayerStore((s) => s.favorites);
  const downloadedTracks = usePlayerStore((s) => s.downloadedTracks);
  const localTracks = usePlayerStore((s) => s.localTracks);
  const t = usePlayerStore((s) => s.t());

  const activeDownloadsCount = downloads.filter(
    (d) =>
      d.status === 'queued' ||
      d.status === 'resolving' ||
      d.status === 'downloading' ||
      d.status === 'tagging'
  ).length;

  const offlineCount = Object.keys(downloadedTracks).length + localTracks.length;

  const navItems: Array<{
    id: ActiveView;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
  }> = [
    { id: 'discover', label: t.nav.discover, icon: <Compass size={18} weight="light" /> },
    { id: 'search', label: t.nav.search, icon: <MagnifyingGlass size={18} weight="light" /> },
    { id: 'batch-url', label: t.nav.batchUrl, icon: <LinkSimple size={18} weight="light" /> },
    {
      id: 'library',
      label: t.nav.library,
      icon: <FolderSimple size={18} weight="light" />,
      badge: offlineCount > 0 ? offlineCount : undefined,
    },
    {
      id: 'downloads',
      label: t.nav.downloads,
      icon: <DownloadSimple size={18} weight="light" />,
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
    },
    { id: 'settings', label: t.nav.settings, icon: <GearSix size={18} weight="light" /> },
  ];

  return (
    <aside className="relative z-10 flex w-[202px] lg:w-[236px] shrink-0 flex-col border-r border-white/[0.07] bg-black/25 px-3 py-4 backdrop-blur-2xl">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-[14px] px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
                isActive
                  ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
                  : 'text-white/62 hover:bg-white/[0.055] hover:text-white'
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={isActive ? 'text-white' : 'text-white/55'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-mono text-[10.5px] tabular-nums',
                    item.id === 'downloads'
                      ? 'bg-cyan-400/20 text-cyan-200'
                      : 'bg-white/10 text-white/65'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Playlists & Liked Songs Section */}
      <div className="mt-5 flex flex-1 flex-col overflow-hidden border-t border-white/[0.07] pt-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
            {t.nav.playlists}
          </span>
          <button
            type="button"
            onClick={() => openCreatePlaylistModal()}
            title={t.nav.newPlaylist}
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-white/75 hover:bg-white/15 hover:text-white"
          >
            <Plus size={14} weight="bold" />
          </button>
        </div>

        <div className="mt-2.5 flex-1 space-y-1 overflow-y-auto pr-1 pb-24">
          {/* Pinned Automatic Liked Songs Playlist */}
          <button
            type="button"
            onClick={() => setView('favorites')}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors',
              activeView === 'favorites'
                ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                : 'text-white/75 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <PlaylistCoverMosaic
              variant="liked"
              title={t.playlist.likedSongsTitle}
              className="h-8 w-8 shrink-0 rounded-lg"
              iconSize={14}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{t.playlist.likedSongsTitle}</p>
              <p className="font-mono text-[10.5px] text-white/45">
                {favorites.length} {t.library.tracksUnit}
              </p>
            </div>
          </button>

          {/* User-created Playlists */}
          {playlists.map((pl) => {
            const isSelected = activeView === 'playlist' && selectedPlaylistId === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => openPlaylist(pl.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors',
                  isSelected
                    ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                    : 'text-white/65 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                <PlaylistCoverMosaic
                  title={pl.name}
                  coverUrl={pl.coverUrl}
                  tracks={pl.tracks}
                  className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-white/10"
                  iconSize={14}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{pl.name}</p>
                  <p className="font-mono text-[10.5px] text-white/40">
                    {pl.tracks.length} {t.library.tracksUnit}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
