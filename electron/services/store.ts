import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppSettings, LibrarySnapshot, Playlist, Track } from '../../src/types/music';
import { mediaServer } from './mediaServer';

interface PersistedData {
  downloadedTracks: Record<string, Track>;
  localTracks: Track[];
  favorites: Track[];
  playlists: Playlist[];
  recentlyPlayed: Track[];
  settings: AppSettings;
  closeOnExitMigrated?: boolean;
}

export const DEFAULT_EQ_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function getDefaultDownloadDir(): string {
  try {
    return path.join(app.getPath('music'), 'Aether Music');
  } catch {
    return path.join(process.cwd(), 'Downloads');
  }
}

function getDefaultData(): PersistedData {
  const defaultDir = getDefaultDownloadDir();
  return {
    downloadedTracks: {},
    localTracks: [],
    favorites: [],
    playlists: [],
    recentlyPlayed: [],
    settings: {
      language: 'vi',
      downloadDir: defaultDir,
      localFolders: [],
      crossfadeSeconds: 3,
      eqEnabled: true,
      eqPreset: 'flat',
      eqBands: [...DEFAULT_EQ_BANDS],
      minimizeToTray: false,
      maxConcurrentDownloads: 2,
      lyricOffsets: {},
      desktopLyricsLocked: false,
      youtubeConnected: false,
      youtubeAuthMode: 'none',
      youtubeBrowser: 'auto',
      youtubeCookieFile: '',
      spotifyConnected: false,
    },
    closeOnExitMigrated: true,
  };
}

export function normalizeTrackKey(artist: string, title: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .replace(/[^a-z0-9]/g, '');
  return `${clean(artist)}::${clean(title)}`;
}

class LibraryStore {
  private filePath = '';
  private data: PersistedData | null = null;
  private normalizedLookup = new Map<string, Track>();

  private ensureInit(): PersistedData {
    if (this.data) return this.data;

    const dataDir = path.join(app.getPath('appData'), 'aether-music');
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'aether-library.json');

    const defaults = getDefaultData();
    let needsSave = false;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<PersistedData>;
        const settings: AppSettings = {
          ...defaults.settings,
          ...(raw.settings ?? {}),
          lyricOffsets: raw.settings?.lyricOffsets ?? {},
          eqBands:
            Array.isArray(raw.settings?.eqBands) && raw.settings.eqBands.length === 10
              ? raw.settings.eqBands
              : [...DEFAULT_EQ_BANDS],
        };
        if (!raw.closeOnExitMigrated) {
          settings.minimizeToTray = false;
          needsSave = true;
        }
        this.data = {
          downloadedTracks: raw.downloadedTracks ?? {},
          localTracks: Array.isArray(raw.localTracks) ? raw.localTracks : [],
          favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
          playlists: Array.isArray(raw.playlists) ? raw.playlists : [],
          recentlyPlayed: Array.isArray(raw.recentlyPlayed) ? raw.recentlyPlayed : [],
          settings,
          closeOnExitMigrated: true,
        };
      } else {
        this.data = defaults;
      }
    } catch {
      this.data = defaults;
    }

    if (needsSave) {
      this.save();
    }

    try {
      fs.mkdirSync(this.data.settings.downloadDir, { recursive: true });
    } catch {
      // Ignore if drive unavailable temporarily
    }

    this.rebuildIndex();
    return this.data;
  }

  private rebuildIndex(): void {
    if (!this.data) return;
    this.normalizedLookup.clear();

    for (const track of Object.values(this.data.downloadedTracks)) {
      if (track.localPath && fs.existsSync(track.localPath)) {
        this.normalizedLookup.set(normalizeTrackKey(track.artist, track.title), track);
      }
    }
    for (const track of this.data.localTracks) {
      if (track.localPath && fs.existsSync(track.localPath)) {
        const key = normalizeTrackKey(track.artist, track.title);
        if (!this.normalizedLookup.has(key)) {
          this.normalizedLookup.set(key, track);
        }
      }
    }
  }

  private save(): void {
    const data = this.ensureInit();
    try {
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  private refreshTrackUrls(track: Track): Track {
    const port = mediaServer.getPort();
    if (
      port > 0 &&
      track.localPath &&
      track.coverUrl &&
      track.coverUrl.startsWith('http://127.0.0.1:')
    ) {
      return { ...track, coverUrl: mediaServer.getLocalCoverUrl(track.localPath) };
    }
    return track;
  }

  public getSnapshot(): LibrarySnapshot {
    const data = this.ensureInit();
    // Filter out downloaded tracks whose files were manually moved/deleted by user externally
    const validDownloaded: Record<string, Track> = {};
    for (const [id, tr] of Object.entries(data.downloadedTracks)) {
      if (tr.localPath && fs.existsSync(tr.localPath)) {
        validDownloaded[id] = this.refreshTrackUrls(tr);
      }
    }
    data.downloadedTracks = validDownloaded;
    return {
      downloadedTracks: { ...validDownloaded },
      localTracks: data.localTracks
        .filter((t) => t.localPath && fs.existsSync(t.localPath))
        .map((t) => this.refreshTrackUrls(t)),
      favorites: data.favorites.map((t) => this.refreshTrackUrls(t)),
      playlists: data.playlists.map((pl) => ({
        ...pl,
        tracks: pl.tracks.map((t) => this.refreshTrackUrls(t)),
      })),
      recentlyPlayed: data.recentlyPlayed.map((t) => this.refreshTrackUrls(t)),
      settings: { ...data.settings },
    };
  }

  public getSettings(): AppSettings {
    return { ...this.ensureInit().settings };
  }

  public updateSettings(patch: Partial<AppSettings>): AppSettings {
    const data = this.ensureInit();
    data.settings = {
      ...data.settings,
      ...patch,
      lyricOffsets: patch.lyricOffsets ?? data.settings.lyricOffsets,
    };
    if (patch.downloadDir) {
      fs.mkdirSync(data.settings.downloadDir, { recursive: true });
    }
    this.save();
    return { ...data.settings };
  }

  public setLyricOffset(trackId: string, offsetMs: number): AppSettings {
    const data = this.ensureInit();
    data.settings.lyricOffsets = {
      ...data.settings.lyricOffsets,
      [trackId]: offsetMs,
    };
    this.save();
    return { ...data.settings };
  }

  public hydrateTrack(track: Track): Track {
    this.ensureInit();
    if (track.localPath && fs.existsSync(track.localPath)) {
      return this.refreshTrackUrls(track);
    }
    const byId = this.data!.downloadedTracks[track.id];
    if (byId && byId.localPath && fs.existsSync(byId.localPath)) {
      return { ...track, localPath: byId.localPath, lrcPath: byId.lrcPath, bitrate: byId.bitrate ?? 320 };
    }
    const byKey = this.normalizedLookup.get(normalizeTrackKey(track.artist, track.title));
    if (byKey && byKey.localPath && fs.existsSync(byKey.localPath)) {
      return { ...track, localPath: byKey.localPath, lrcPath: byKey.lrcPath, bitrate: byKey.bitrate ?? 320 };
    }
    return track;
  }

  public addDownloadedTrack(track: Track): void {
    const data = this.ensureInit();
    data.downloadedTracks[track.id] = {
      ...track,
      addedAt: track.addedAt ?? Date.now(),
    };
    this.rebuildIndex();
    this.save();
  }

  public setLocalTracks(tracks: Track[], folders?: string[]): void {
    const data = this.ensureInit();
    data.localTracks = tracks;
    if (folders) {
      data.settings.localFolders = folders;
    }
    this.rebuildIndex();
    this.save();
  }

  public toggleFavorite(track: Track): Track[] {
    const data = this.ensureInit();
    const idx = data.favorites.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      data.favorites.splice(idx, 1);
    } else {
      data.favorites.unshift(this.hydrateTrack(track));
    }
    this.save();
    return [...data.favorites];
  }

  public recordPlay(track: Track): Track[] {
    const data = this.ensureInit();
    const hydrated = this.hydrateTrack(track);
    data.recentlyPlayed = [
      hydrated,
      ...data.recentlyPlayed.filter((t) => t.id !== track.id),
    ].slice(0, 30);
    this.save();
    return [...data.recentlyPlayed];
  }

  public createPlaylist(name: string, description = ''): Playlist[] {
    const data = this.ensureInit();
    const playlist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      description,
      trackIds: [],
      tracks: [],
      createdAt: Date.now(),
    };
    data.playlists.unshift(playlist);
    this.save();
    return [...data.playlists];
  }

  public addTrackToPlaylist(playlistId: string, track: Track): Playlist[] {
    const data = this.ensureInit();
    const pl = data.playlists.find((p) => p.id === playlistId);
    if (pl && !pl.tracks.some((t) => t.id === track.id)) {
      const hydrated = this.hydrateTrack(track);
      pl.tracks.push(hydrated);
      pl.trackIds.push(hydrated.id);
      if (!pl.coverUrl && hydrated.coverUrl) {
        pl.coverUrl = hydrated.coverUrl;
      }
      this.save();
    }
    return [...data.playlists];
  }

  public removeTrackFromPlaylist(playlistId: string, trackId: string): Playlist[] {
    const data = this.ensureInit();
    const pl = data.playlists.find((p) => p.id === playlistId);
    if (pl) {
      pl.tracks = pl.tracks.filter((t) => t.id !== trackId);
      pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
      pl.coverUrl = pl.tracks.find((t) => Boolean(t.coverUrl))?.coverUrl;
      this.save();
    }
    return [...data.playlists];
  }

  public updatePlaylist(
    playlistId: string,
    patch: { name?: string; description?: string }
  ): Playlist[] {
    const data = this.ensureInit();
    const pl = data.playlists.find((p) => p.id === playlistId);
    if (pl) {
      if (typeof patch.name === 'string' && patch.name.trim()) {
        pl.name = patch.name.trim();
      }
      if (typeof patch.description === 'string') {
        pl.description = patch.description.trim();
      }
      this.save();
    }
    return [...data.playlists];
  }

  public reorderPlaylistTracks(playlistId: string, orderedTrackIds: string[]): Playlist[] {
    const data = this.ensureInit();
    const pl = data.playlists.find((p) => p.id === playlistId);
    if (pl) {
      const byId = new Map(pl.tracks.map((t) => [t.id, t]));
      const reordered: Track[] = [];
      for (const id of orderedTrackIds) {
        const found = byId.get(id);
        if (found) {
          reordered.push(found);
          byId.delete(id);
        }
      }
      for (const leftover of byId.values()) {
        reordered.push(leftover);
      }
      pl.tracks = reordered;
      pl.trackIds = reordered.map((t) => t.id);
      pl.coverUrl = reordered.find((t) => Boolean(t.coverUrl))?.coverUrl;
      this.save();
    }
    return [...data.playlists];
  }

  public deletePlaylist(playlistId: string): Playlist[] {
    const data = this.ensureInit();
    data.playlists = data.playlists.filter((p) => p.id !== playlistId);
    this.save();
    return [...data.playlists];
  }
}

export const libraryStore = new LibraryStore();
