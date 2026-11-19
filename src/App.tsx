import React, { useEffect } from 'react';
import { usePlayerStore } from './store/usePlayerStore';
import { AmbientCanvas } from './components/layout/AmbientCanvas';
import { Titlebar } from './components/layout/Titlebar';
import { Sidebar } from './components/layout/Sidebar';
import { RightStudioPanel } from './components/layout/RightStudioPanel';
import { PlayerDock } from './components/layout/PlayerDock';
import { QueueDrawer } from './components/layout/QueueDrawer';
import { EqualizerModal } from './components/audio/EqualizerModal';
import { AddToPlaylistModal } from './components/audio/AddToPlaylistModal';
import { CreatePlaylistModal } from './components/audio/CreatePlaylistModal';
import { TrackContextMenu } from './components/ui/TrackContextMenu';
import { ToastHost } from './components/ui/ToastHost';
import { ImmersiveLyricsModal } from './components/lyrics/ImmersiveLyricsModal';
import { DesktopLyricsApp } from './components/lyrics/DesktopLyricsApp';
import { MvPlayerModal } from './components/video/MvPlayerModal';
import { DiscoverView } from './views/DiscoverView';
import { SearchView } from './views/SearchView';
import { AlbumDetailView } from './views/AlbumDetailView';
import { UrlBatchView } from './views/UrlBatchView';
import { LibraryView } from './views/LibraryView';
import { DownloadsView } from './views/DownloadsView';
import { CollectionView } from './views/CollectionView';
import { SettingsView } from './views/SettingsView';

const MainAppShell: React.FC = () => {
  const initApp = usePlayerStore((s) => s.initApp);
  const activeView = usePlayerStore((s) => s.activeView);
  const streamError = usePlayerStore((s) => s.streamError);

  useEffect(() => {
    void initApp();

    const onSpaceToggle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        void usePlayerStore.getState().togglePlayPause();
      }
    };
    window.addEventListener('keydown', onSpaceToggle);
    return () => window.removeEventListener('keydown', onSpaceToggle);
  }, [initApp]);

  const renderView = () => {
    switch (activeView) {
      case 'discover':
        return <DiscoverView />;
      case 'search':
        return <SearchView />;
      case 'album':
        return <AlbumDetailView />;
      case 'batch-url':
        return <UrlBatchView />;
      case 'library':
        return <LibraryView />;
      case 'downloads':
        return <DownloadsView />;
      case 'favorites':
        return <CollectionView mode="favorites" />;
      case 'playlist':
        return <CollectionView mode="playlist" />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DiscoverView />;
    }
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#07080C] text-white">
      <AmbientCanvas />
      <div className="aether-grain" />

      <Titlebar />

      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="main-stage-container flex-1 min-w-0 overflow-y-auto px-5 lg:px-7 pt-5">
          {streamError && (
            <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-2.5 text-[13px] text-rose-200">
              {streamError}
            </div>
          )}
          {renderView()}
        </main>
        <RightStudioPanel />
      </div>

      <PlayerDock />
      <QueueDrawer />
      <EqualizerModal />
      <AddToPlaylistModal />
      <CreatePlaylistModal />
      <TrackContextMenu />
      <ToastHost />
      <ImmersiveLyricsModal />
      <MvPlayerModal />
    </div>
  );
};

export const App: React.FC = () => {
  const isDesktopLyrics =
    typeof window !== 'undefined' &&
    (window.location.search.includes('window=desktop-lyrics') ||
      window.location.hash === '#desktop-lyrics');

  if (isDesktopLyrics) {
    return <DesktopLyricsApp />;
  }

  return <MainAppShell />;
};

export default App;
