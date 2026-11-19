import {
  Album,
  AppSettings,
  DesktopIslandBounds,
  DesktopLyricsSyncPayload,
  DiscoverFeed,
  DownloadTask,
  LibrarySnapshot,
  LyricsPayload,
  MusicVideoInfo,
  MvStreamPayload,
  Playlist,
  SearchResult,
  StreamResolution,
  Track,
  UrlBatchParseResult,
  YouTubeBrowserId,
  YouTubeVerifyResult,
} from './music';

export interface AetherElectronAPI {
  getMediaPort: () => Promise<number>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  onWindowMaximized: (cb: (maximized: boolean) => void) => () => void;

  getDiscoverFeed: () => Promise<DiscoverFeed>;
  searchCatalog: (query: string) => Promise<SearchResult>;
  getAlbumDetails: (albumId: string) => Promise<Album | null>;
  searchYouTubeMusic: (query: string) => Promise<Track[]>;
  parseUrlBatch: (url: string) => Promise<UrlBatchParseResult>;

  resolveStream: (track: Track) => Promise<StreamResolution>;
  prefetchStream: (track: Track) => Promise<void>;
  checkTrackMv: (track: Track, audioYoutubeId?: string) => Promise<MusicVideoInfo | null>;
  resolveMvStream: (youtubeId: string) => Promise<MvStreamPayload>;
  getLyrics: (track: Track, actualDuration?: number) => Promise<LyricsPayload>;
  setLyricOffset: (trackId: string, offsetMs: number) => Promise<AppSettings>;
  toggleDesktopLyrics: (force?: boolean) => Promise<boolean>;
  setDesktopLyricsLock: (locked: boolean) => Promise<AppSettings>;
  getInitialDesktopLyrics: () => Promise<DesktopLyricsSyncPayload | null>;
  syncDesktopLyrics: (payload: DesktopLyricsSyncPayload) => void;
  sendDesktopLyricsCommand: (cmd: 'play-pause' | 'next' | 'prev' | 'unlock' | 'close') => void;
  moveDesktopLyricsBy: (dx: number, dy: number) => void;
  setDesktopIslandBounds: (bounds: DesktopIslandBounds) => void;
  onDesktopLyricsSync: (cb: (payload: DesktopLyricsSyncPayload) => void) => () => void;
  onDesktopLyricsState: (cb: (open: boolean) => void) => () => void;
  onDesktopLyricsLockState: (cb: (locked: boolean) => void) => () => void;
  onMediaKey: (cb: (cmd: string) => void) => () => void;

  getDownloads: () => Promise<DownloadTask[]>;
  enqueueDownloads: (tracks: Track[], albumTitle?: string) => Promise<DownloadTask[]>;
  cancelDownload: (taskId: string) => Promise<DownloadTask[]>;
  retryDownload: (taskId: string) => Promise<DownloadTask[]>;
  clearCompletedDownloads: () => Promise<DownloadTask[]>;
  onDownloadsUpdated: (cb: (tasks: DownloadTask[]) => void) => () => void;

  getLibrarySnapshot: () => Promise<LibrarySnapshot>;
  onLibraryUpdated: (cb: (snapshot: LibrarySnapshot) => void) => () => void;
  toggleFavorite: (track: Track) => Promise<Track[]>;
  recordPlay: (track: Track) => Promise<Track[]>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist[]>;
  updatePlaylist: (playlistId: string, patch: { name?: string; description?: string }) => Promise<Playlist[]>;
  reorderPlaylistTracks: (playlistId: string, orderedIds: string[]) => Promise<Playlist[]>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<Playlist[]>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<Playlist[]>;
  deletePlaylist: (playlistId: string) => Promise<Playlist[]>;
  addLocalFolder: () => Promise<Track[]>;
  rescanLocalFolders: () => Promise<Track[]>;
  removeLocalFolder: (folder: string) => Promise<Track[]>;

  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  onSettingsUpdated: (cb: (settings: AppSettings) => void) => () => void;
  pickDownloadDir: () => Promise<AppSettings>;
  detectDefaultBrowser: () => Promise<{
    browser: Exclude<YouTubeBrowserId, 'auto'> | null;
    label: string;
  }>;
  loginYouTube: (browser?: YouTubeBrowserId) => Promise<AppSettings>;
  verifyYouTubeAuth: () => Promise<YouTubeVerifyResult>;
  pickYouTubeCookieFile: () => Promise<AppSettings>;
  logoutYouTube: () => Promise<AppSettings>;
  loginSpotify: () => Promise<AppSettings>;
  logoutSpotify: () => Promise<AppSettings>;
  openFolder: (targetPath?: string) => Promise<void>;
  revealFile: (filePath: string) => Promise<void>;
}

declare global {
  interface Window {
    aetherAPI: AetherElectronAPI;
  }
}
