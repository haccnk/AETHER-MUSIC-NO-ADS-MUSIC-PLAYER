import { contextBridge, ipcRenderer } from 'electron';
import {
  AppSettings,
  DesktopIslandBounds,
  DesktopLyricsSyncPayload,
  DownloadTask,
  LibrarySnapshot,
  MusicVideoInfo,
  MvStreamPayload,
  Track,
  YouTubeBrowserId,
} from '../src/types/music';

const api = {
  // Media port & Window controls
  getMediaPort: () => ipcRenderer.invoke('app:media-port'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowMaximized: (cb: (maximized: boolean) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },

  // Catalog & Search
  getDiscoverFeed: () => ipcRenderer.invoke('catalog:discover'),
  searchCatalog: (query: string) => ipcRenderer.invoke('catalog:search', query),
  getAlbumDetails: (albumId: string) => ipcRenderer.invoke('catalog:album', albumId),
  searchYouTubeMusic: (query: string) => ipcRenderer.invoke('catalog:search-yt', query),
  parseUrlBatch: (url: string) => ipcRenderer.invoke('catalog:parse-url', url),

  // Streaming & Lyrics
  resolveStream: (track: Track) => ipcRenderer.invoke('stream:resolve', track),
  prefetchStream: (track: Track) => ipcRenderer.invoke('stream:prefetch', track),
  checkTrackMv: (track: Track, audioYoutubeId?: string): Promise<MusicVideoInfo | null> =>
    ipcRenderer.invoke('mv:check', track, audioYoutubeId),
  resolveMvStream: (youtubeId: string): Promise<MvStreamPayload> =>
    ipcRenderer.invoke('mv:resolve', youtubeId),
  getLyrics: (track: Track, actualDuration?: number) =>
    ipcRenderer.invoke('lyrics:get', track, actualDuration),
  setLyricOffset: (trackId: string, offsetMs: number) =>
    ipcRenderer.invoke('lyrics:set-offset', trackId, offsetMs),
  toggleDesktopLyrics: (force?: boolean) => ipcRenderer.invoke('lyrics:toggle-desktop', force),
  setDesktopLyricsLock: (locked: boolean) => ipcRenderer.invoke('lyrics:set-lock', locked),
  getInitialDesktopLyrics: () => ipcRenderer.invoke('lyrics:get-desktop-initial'),
  syncDesktopLyrics: (payload: DesktopLyricsSyncPayload) =>
    ipcRenderer.send('lyrics:sync-desktop', payload),
  sendDesktopLyricsCommand: (cmd: 'play-pause' | 'next' | 'prev' | 'unlock' | 'close') =>
    ipcRenderer.send('desktop-lyrics:command', cmd),
  moveDesktopLyricsBy: (dx: number, dy: number) =>
    ipcRenderer.send('desktop-lyrics:move-by', dx, dy),
  setDesktopIslandBounds: (bounds: DesktopIslandBounds) =>
    ipcRenderer.send('desktop-lyrics:set-island-bounds', bounds),
  onDesktopLyricsSync: (cb: (payload: DesktopLyricsSyncPayload) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: DesktopLyricsSyncPayload) =>
      cb(payload);
    ipcRenderer.on('lyrics:desktop-sync', handler);
    return () => ipcRenderer.removeListener('lyrics:desktop-sync', handler);
  },
  onDesktopLyricsState: (cb: (open: boolean) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, open: boolean) => cb(open);
    ipcRenderer.on('lyrics:desktop-state', handler);
    return () => ipcRenderer.removeListener('lyrics:desktop-state', handler);
  },
  onDesktopLyricsLockState: (cb: (locked: boolean) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, locked: boolean) => cb(locked);
    ipcRenderer.on('lyrics:desktop-lock-state', handler);
    return () => ipcRenderer.removeListener('lyrics:desktop-lock-state', handler);
  },

  // Media keys
  onMediaKey: (cb: (cmd: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, cmd: string) => cb(cmd);
    ipcRenderer.on('player:media-key', handler);
    return () => ipcRenderer.removeListener('player:media-key', handler);
  },

  // Downloads
  getDownloads: () => ipcRenderer.invoke('downloads:list'),
  enqueueDownloads: (tracks: Track[], albumTitle?: string) =>
    ipcRenderer.invoke('downloads:enqueue', tracks, albumTitle),
  cancelDownload: (taskId: string) => ipcRenderer.invoke('downloads:cancel', taskId),
  retryDownload: (taskId: string) => ipcRenderer.invoke('downloads:retry', taskId),
  clearCompletedDownloads: () => ipcRenderer.invoke('downloads:clear'),
  onDownloadsUpdated: (cb: (tasks: DownloadTask[]) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, tasks: DownloadTask[]) => cb(tasks);
    ipcRenderer.on('downloads:updated', handler);
    return () => ipcRenderer.removeListener('downloads:updated', handler);
  },

  // Library & Playlists
  getLibrarySnapshot: () => ipcRenderer.invoke('library:snapshot'),
  onLibraryUpdated: (cb: (snapshot: LibrarySnapshot) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, snapshot: LibrarySnapshot) => cb(snapshot);
    ipcRenderer.on('library:updated', handler);
    return () => ipcRenderer.removeListener('library:updated', handler);
  },
  toggleFavorite: (track: Track) => ipcRenderer.invoke('library:toggle-favorite', track),
  recordPlay: (track: Track) => ipcRenderer.invoke('library:record-play', track),
  createPlaylist: (name: string, description?: string) =>
    ipcRenderer.invoke('library:playlist-create', name, description),
  updatePlaylist: (playlistId: string, patch: { name?: string; description?: string }) =>
    ipcRenderer.invoke('library:playlist-update', playlistId, patch),
  reorderPlaylistTracks: (playlistId: string, orderedIds: string[]) =>
    ipcRenderer.invoke('library:playlist-reorder', playlistId, orderedIds),
  addTrackToPlaylist: (playlistId: string, track: Track) =>
    ipcRenderer.invoke('library:playlist-add-track', playlistId, track),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    ipcRenderer.invoke('library:playlist-remove-track', playlistId, trackId),
  deletePlaylist: (playlistId: string) => ipcRenderer.invoke('library:playlist-delete', playlistId),
  addLocalFolder: () => ipcRenderer.invoke('library:add-local-folder'),
  rescanLocalFolders: () => ipcRenderer.invoke('library:rescan-local'),
  removeLocalFolder: (folder: string) => ipcRenderer.invoke('library:remove-local-folder', folder),

  // Settings & Explorer
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', patch),
  onSettingsUpdated: (cb: (settings: AppSettings) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, settings: AppSettings) => cb(settings);
    ipcRenderer.on('settings:updated', handler);
    return () => ipcRenderer.removeListener('settings:updated', handler);
  },
  pickDownloadDir: () => ipcRenderer.invoke('settings:pick-download-dir'),
  detectDefaultBrowser: () => ipcRenderer.invoke('auth:youtube-detect-browser'),
  loginYouTube: (browser?: YouTubeBrowserId) => ipcRenderer.invoke('auth:youtube-login', browser),
  verifyYouTubeAuth: () => ipcRenderer.invoke('auth:youtube-verify'),
  pickYouTubeCookieFile: () => ipcRenderer.invoke('auth:youtube-pick-cookies'),
  logoutYouTube: () => ipcRenderer.invoke('auth:youtube-logout'),
  loginSpotify: () => ipcRenderer.invoke('auth:spotify-login'),
  logoutSpotify: () => ipcRenderer.invoke('auth:spotify-logout'),
  openFolder: (targetPath?: string) => ipcRenderer.invoke('shell:open-folder', targetPath),
  revealFile: (filePath: string) => ipcRenderer.invoke('shell:reveal-file', filePath),
};

contextBridge.exposeInMainWorld('aetherAPI', api);
export type AetherAPI = typeof api;
