export type SourceType = 'catalog' | 'spotify' | 'youtube' | 'local';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId?: string;
  duration: number; // seconds
  coverUrl: string;
  trackNumber?: number;
  year?: string;
  youtubeId?: string;
  sourceUrl?: string;
  localPath?: string;
  lrcPath?: string;
  sourceType: SourceType;
  bitrate?: number;
  addedAt?: number;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year?: string;
  trackCount?: number;
  tracks?: Track[];
  source: SourceType;
  genre?: string;
}

export interface LyricLine {
  timeMs: number;
  endTimeMs: number;
  text: string;
}

export interface LyricCandidate {
  id: number;
  label: string;
  duration: number;
  lines: LyricLine[];
}

export interface LyricsPayload {
  trackId: string;
  synced: boolean;
  lines: LyricLine[];
  plainText?: string;
  source: 'local' | 'lrclib' | 'none';
  candidates?: LyricCandidate[];
  selectedCandidateId?: number;
}

export type DownloadStatus =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'tagging'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadTask {
  id: string;
  track: Track;
  albumBatchId?: string;
  albumTitle?: string;
  status: DownloadStatus;
  progress: number;
  speed?: string;
  outputPath?: string;
  error?: string;
  createdAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackIds: string[];
  tracks: Track[];
  createdAt: number;
}

export interface PlaylistPatch {
  name?: string;
  description?: string;
}

export type YouTubeBrowserId =
  | 'auto'
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'brave'
  | 'opera'
  | 'vivaldi';

export interface YouTubeVerifyResult {
  ok: boolean;
  browser?: string;
  errorCode?:
    | 'cookie-locked'
    | 'dpapi-encrypted'
    | 'not-signed-in'
    | 'missing-browser'
    | 'unknown';
  message: string;
}

export interface AppSettings {
  language: 'vi' | 'en';
  downloadDir: string;
  localFolders: string[];
  crossfadeSeconds: number;
  eqEnabled: boolean;
  eqPreset: string;
  eqBands: number[];
  minimizeToTray: boolean;
  maxConcurrentDownloads: number;
  lyricOffsets: Record<string, number>;
  desktopLyricsLocked: boolean;
  youtubeConnected?: boolean;
  youtubeAuthMode?: 'none' | 'browser-cookies' | 'browser-login' | 'cookie-file';
  youtubeBrowser?: YouTubeBrowserId;
  youtubeCookieFile?: string;
  spotifyConnected?: boolean;
}

export interface DiscoverFeed {
  featuredAlbum: Album | null;
  vnAlbums: Album[];
  intlAlbums: Album[];
  trendingTracks: Track[];
}

export interface SearchResult {
  albums: Album[];
  tracks: Track[];
}

export interface UrlBatchParseResult {
  title: string;
  artist: string;
  coverUrl: string;
  sourceUrl: string;
  tracks: Track[];
  provider?: 'spotify' | 'youtube' | 'other';
}

export interface DesktopIslandBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export interface DesktopLyricsSyncPayload {
  trackTitle: string;
  artist: string;
  coverUrl: string;
  currentLine: string;
  nextLine: string;
  lineProgress: number;
  isPlaying: boolean;
  accentColor: string;
  locked: boolean;
  language: 'vi' | 'en';
  spectrum?: number[];
}

export interface LibrarySnapshot {
  downloadedTracks: Record<string, Track>;
  localTracks: Track[];
  favorites: Track[];
  playlists: Playlist[];
  recentlyPlayed: Track[];
  settings: AppSettings;
}

export interface StreamResolution {
  url: string;
  isLocal: boolean;
  youtubeId?: string;
  actualDuration?: number;
}

export interface MusicVideoInfo {
  youtubeId: string;
  title: string;
  channel: string;
  duration: number;
  thumbnailUrl: string;
  viewCountText?: string;
}

export interface MvStreamPayload {
  videoUrl: string;
  audioUrl?: string;
  resolution?: string;
  duration?: number;
}

export type ActiveView =
  | 'discover'
  | 'search'
  | 'album'
  | 'batch-url'
  | 'library'
  | 'downloads'
  | 'favorites'
  | 'playlist'
  | 'settings';
