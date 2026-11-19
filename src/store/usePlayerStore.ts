import { create } from 'zustand';
import {
  ActiveView,
  Album,
  AppSettings,
  DesktopLyricsSyncPayload,
  DiscoverFeed,
  DownloadTask,
  LibrarySnapshot,
  LyricsPayload,
  MusicVideoInfo,
  MvStreamPayload,
  Playlist,
  PlaylistPatch,
  Track,
} from '../types/music';
import { audioEngine, EQ_PRESETS } from '../audio/AudioEngine';
import {
  DEFAULT_AMBIENT_PALETTE,
  extractAmbientPalette,
  RgbTuple,
  rgbToCss,
} from '../utils/colorExtractor';
import { translations, TranslationDict } from '../i18n/translations';

export type RepeatMode = 'off' | 'all' | 'one';

interface SleepTimerState {
  mode: 'off' | 'minutes' | 'end-of-track';
  remainingSec: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  track: Track;
  queueContext?: Track[];
}

interface PlayTrackOptions {
  useCrossfade?: boolean;
  contextName?: string;
  fromPriority?: boolean;
  fromHistory?: boolean;
  skipHistoryPush?: boolean;
}

interface PlayerStoreState {
  mediaPort: number;

  // Navigation
  activeView: ActiveView;
  selectedAlbumId: string | null;
  selectedAlbum: Album | null;
  selectedPlaylistId: string | null;
  searchQuery: string;
  albumLoading: boolean;

  // Modals / Overlays / Panels / Toast
  isRightPanelOpen: boolean;
  isImmersiveLyricsOpen: boolean;
  isDesktopLyricsOpen: boolean;
  isEqOpen: boolean;
  isQueueOpen: boolean;
  isPlaylistModalOpen: boolean;
  trackToAddToPlaylist: Track | null;
  isCreatePlaylistModalOpen: boolean;
  editingPlaylist: Playlist | null;
  contextMenu: ContextMenuState | null;
  toastMessage: string | null;

  // Dual-Layer Spotify-Style Queue & History
  priorityQueue: Track[];
  contextQueue: Track[];
  originalContextQueue: Track[];
  contextIndex: number;
  contextName: string;
  playHistory: Track[];

  // Playback
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoadingStream: boolean;
  streamError: string | null;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  sleepTimer: SleepTimerState;

  // Lyrics & Ambient & Official MV
  lyricsPayload: LyricsPayload | null;
  lyricsLoading: boolean;
  ambientPalette: RgbTuple[];
  currentMv: MusicVideoInfo | null;
  isMvOpen: boolean;
  mvStream: MvStreamPayload | null;
  mvLoading: boolean;
  mvError: string | null;

  // Catalog & Library
  discoverFeed: DiscoverFeed | null;
  discoverLoading: boolean;
  downloads: DownloadTask[];
  downloadedTracks: Record<string, Track>;
  localTracks: Track[];
  favorites: Track[];
  playlists: Playlist[];
  recentlyPlayed: Track[];
  settings: AppSettings;

  // Actions
  t: () => TranslationDict;
  showToast: (msg: string) => void;
  initApp: () => Promise<void>;
  setView: (view: ActiveView) => void;
  setSearchQuery: (q: string) => void;
  openAlbum: (albumId: string, previewAlbum?: Album) => Promise<void>;
  openPlaylist: (playlistId: string) => void;
  toggleRightPanel: () => void;

  playTrack: (
    track: Track,
    newContextTracks?: Track[],
    opts?: PlayTrackOptions
  ) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextTrack: (viaCrossfade?: boolean) => Promise<void>;
  prevTrack: () => Promise<void>;

  playNextInQueue: (track: Track) => void;
  addToQueue: (track: Track) => void;
  reorderPriorityQueue: (nextList: Track[]) => void;
  removeFromPriorityQueue: (index: number) => void;
  clearPriorityQueue: () => void;
  reorderUpcomingContext: (nextUpcoming: Track[]) => void;
  removeFromUpcomingContext: (upcomingIdx: number) => void;
  jumpToQueueItem: (source: 'priority' | 'context', idx: number) => Promise<void>;

  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (vol: number, muted?: boolean) => void;
  setSleepTimer: (minutes: number | 'end-of-track' | null) => void;

  setImmersiveLyricsOpen: (open: boolean) => void;
  toggleDesktopLyrics: () => Promise<void>;
  selectLyricCandidate: (candidateId: number) => void;
  openMvModal: () => Promise<void>;
  closeMvModal: () => void;
  setEqOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  openAddToPlaylistModal: (track: Track) => void;
  closeAddToPlaylistModal: () => void;
  openCreatePlaylistModal: (playlistToEdit?: Playlist) => void;
  closeCreatePlaylistModal: () => void;
  openTrackContextMenu: (x: number, y: number, track: Track, queueContext?: Track[]) => void;
  closeTrackContextMenu: () => void;

  toggleFavorite: (track: Track) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
  updatePlaylist: (playlistId: string, patch: PlaylistPatch) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, orderedIds: string[]) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track, playlistName?: string) => Promise<void>;
  removeTrackFromPlaylist: (
    playlistId: string,
    trackId: string,
    playlistName?: string
  ) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;

  enqueueDownloads: (tracks: Track[], albumTitle?: string) => Promise<void>;
  cancelDownload: (taskId: string) => Promise<void>;
  retryDownload: (taskId: string) => Promise<void>;
  clearCompletedDownloads: () => Promise<void>;

  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  adjustLyricOffset: (trackId: string, deltaMs: number) => Promise<void>;
  setLyricOffsetExact: (trackId: string, exactOffsetMs: number) => Promise<void>;
  addLocalFolder: () => Promise<void>;
  rescanLocalFolders: () => Promise<void>;
  removeLocalFolder: (folder: string) => Promise<void>;
  pickDownloadDir: () => Promise<void>;
  refreshDiscover: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'vi',
  downloadDir: '',
  localFolders: [],
  crossfadeSeconds: 3,
  eqEnabled: true,
  eqPreset: 'flat',
  eqBands: [...EQ_PRESETS.flat],
  minimizeToTray: false,
  maxConcurrentDownloads: 3,
  lyricOffsets: {},
  desktopLyricsLocked: false,
};

let sleepInterval: ReturnType<typeof setInterval> | null = null;
let desktopSyncInterval: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let latestPlayReqId = 0;
let crossfadeSourceReqId = -1;
const BASE_VOCAL_LEAD_MS = 55;

function fisherYates<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function applyLibrarySnapshot(
  snap: LibrarySnapshot,
  set: (partial: Partial<PlayerStoreState>) => void
): void {
  set({
    downloadedTracks: snap.downloadedTracks,
    localTracks: snap.localTracks,
    favorites: snap.favorites,
    playlists: snap.playlists,
    recentlyPlayed: snap.recentlyPlayed,
    settings: snap.settings,
  });
  audioEngine.setCrossfadeSeconds(snap.settings.crossfadeSeconds);
  audioEngine.setEqualizer(snap.settings.eqEnabled, snap.settings.eqBands);
}

function peekNextTrack(state: PlayerStoreState): Track | null {
  if (state.repeat === 'one' && state.currentTrack) return state.currentTrack;
  if (state.priorityQueue.length > 0) return state.priorityQueue[0];
  if (state.contextQueue.length === 0) return null;
  const nextIdx = state.contextIndex + 1;
  if (nextIdx < state.contextQueue.length) return state.contextQueue[nextIdx];
  if (state.repeat === 'all') return state.contextQueue[0];
  return null;
}

function buildDesktopLyricsPayload(st: PlayerStoreState): DesktopLyricsSyncPayload {
  if (!st.currentTrack) {
    return {
      trackTitle: 'Aether Music',
      artist: st.settings.language === 'vi' ? 'Chưa phát bài nào' : 'Nothing Playing',
      coverUrl: '',
      currentLine: '♪ Aether Music',
      nextLine:
        st.settings.language === 'vi'
          ? 'Chọn một bài hát để hiển thị lời'
          : 'Play a track to see synced lyrics',
      lineProgress: 0,
      isPlaying: false,
      accentColor: rgbToCss(st.ambientPalette[0] ?? DEFAULT_AMBIENT_PALETTE[0], 1),
      locked: st.settings.desktopLyricsLocked,
      language: st.settings.language,
      spectrum: [],
    };
  }

  const timeSnap = audioEngine.getCurrentSnapshot();
  const offset = st.settings.lyricOffsets[st.currentTrack.id] ?? 0;
  const latencyMs = audioEngine.getOutputLatencyMs();
  const tMs = timeSnap.currentTimeMs - latencyMs + BASE_VOCAL_LEAD_MS + offset;
  const lines = st.lyricsPayload?.lines ?? [];

  let currentLine = st.currentTrack.title;
  let nextLine = st.currentTrack.artist;
  let lineProgress = 0;

  if (st.lyricsLoading) {
    currentLine = st.currentTrack.title;
    nextLine =
      st.settings.language === 'vi' ? 'Đang tải lời đồng bộ...' : 'Loading synced lyrics...';
  } else if (st.lyricsPayload?.synced && lines.length > 0) {
    let activeIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (tMs >= lines[i].timeMs) activeIdx = i;
      else break;
    }
    if (activeIdx >= 0) {
      const cur = lines[activeIdx];
      currentLine = cur.text;
      nextLine = lines[activeIdx + 1]?.text ?? '';
      const span = Math.max(300, cur.endTimeMs - cur.timeMs);
      lineProgress = Math.max(0, Math.min(1, (tMs - cur.timeMs) / span));
    } else {
      currentLine = '♪ • • •';
      nextLine = lines[0]?.text ?? '';
    }
  }

  return {
    trackTitle: st.currentTrack.title,
    artist: st.currentTrack.artist,
    coverUrl: st.currentTrack.coverUrl,
    currentLine,
    nextLine,
    lineProgress,
    isPlaying: st.isPlaying,
    accentColor: rgbToCss(st.ambientPalette[0] ?? DEFAULT_AMBIENT_PALETTE[0], 1),
    locked: st.settings.desktopLyricsLocked,
    language: st.settings.language,
    spectrum: st.isPlaying ? audioEngine.getCompactSpectrum(28) : [],
  };
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({
  mediaPort: 0,

  activeView: 'discover',
  selectedAlbumId: null,
  selectedAlbum: null,
  selectedPlaylistId: null,
  searchQuery: '',
  albumLoading: false,

  isRightPanelOpen: false,
  isImmersiveLyricsOpen: false,
  isDesktopLyricsOpen: false,
  isEqOpen: false,
  isQueueOpen: false,
  isPlaylistModalOpen: false,
  trackToAddToPlaylist: null,
  isCreatePlaylistModalOpen: false,
  editingPlaylist: null,
  contextMenu: null,
  toastMessage: null,

  priorityQueue: [],
  contextQueue: [],
  originalContextQueue: [],
  contextIndex: -1,
  contextName: '',
  playHistory: [],

  currentTrack: null,
  isPlaying: false,
  isLoadingStream: false,
  streamError: null,
  shuffle: false,
  repeat: 'off',
  volume: 0.85,
  muted: false,
  sleepTimer: { mode: 'off', remainingSec: 0 },

  lyricsPayload: null,
  lyricsLoading: false,
  ambientPalette: DEFAULT_AMBIENT_PALETTE,
  currentMv: null,
  isMvOpen: false,
  mvStream: null,
  mvLoading: false,
  mvError: null,

  discoverFeed: null,
  discoverLoading: false,
  downloads: [],
  downloadedTracks: {},
  localTracks: [],
  favorites: [],
  playlists: [],
  recentlyPlayed: [],
  settings: DEFAULT_SETTINGS,

  t: () => translations[get().settings.language] as unknown as TranslationDict,

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: msg });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
    }, 2600);
  },

  initApp: async () => {
    const api = window.aetherAPI;
    if (!api) return;

    const [mediaPort, snap, downloads] = await Promise.all([
      api.getMediaPort(),
      api.getLibrarySnapshot(),
      api.getDownloads(),
    ]);
    set({ mediaPort, downloads });
    applyLibrarySnapshot(snap, set);

    audioEngine.onTrackEnded = () => {
      const state = get();
      if (state.isLoadingStream || crossfadeSourceReqId === latestPlayReqId) return;
      if (state.sleepTimer.mode === 'end-of-track') {
        set({ isPlaying: false, sleepTimer: { mode: 'off', remainingSec: 0 } });
        return;
      }
      if (state.repeat === 'one' && state.currentTrack) {
        void state.playTrack(state.currentTrack, undefined, { skipHistoryPush: true });
        return;
      }
      void state.nextTrack(false);
    };

    audioEngine.onCrossfadeReady = () => {
      const state = get();
      if (state.isLoadingStream || crossfadeSourceReqId === latestPlayReqId) return;
      if (state.sleepTimer.mode === 'end-of-track' || state.repeat === 'one') return;
      if (peekNextTrack(state)) {
        crossfadeSourceReqId = latestPlayReqId;
        void state.nextTrack(true);
      }
    };

    audioEngine.onPlayStateChange = (playing) => {
      const st = get();
      if (!st.isLoadingStream && st.isPlaying !== playing) {
        set({ isPlaying: playing });
        if (st.isDesktopLyricsOpen) {
          api.syncDesktopLyrics(buildDesktopLyricsPayload(get()));
        }
      }
    };

    audioEngine.onMediaSessionAction = (action) => {
      if (action === 'play') void get().togglePlayPause();
      else if (action === 'pause') void get().togglePlayPause();
      else if (action === 'next') void get().nextTrack(false);
      else if (action === 'prev') void get().prevTrack();
    };

    audioEngine.onPlaybackError = (msg) => {
      set({ isLoadingStream: false, isPlaying: false, streamError: msg });
    };

    api.onDownloadsUpdated((tasks) => set({ downloads: tasks }));
    api.onLibraryUpdated((nextSnap) => {
      applyLibrarySnapshot(nextSnap, set);
      const curAlbum = get().selectedAlbum;
      if (curAlbum && curAlbum.tracks) {
        const updatedTracks = curAlbum.tracks.map(
          (tr) => nextSnap.downloadedTracks[tr.id] ?? tr
        );
        set({ selectedAlbum: { ...curAlbum, tracks: updatedTracks } });
      }
    });
    api.onSettingsUpdated((nextSettings) => {
      set({ settings: nextSettings });
      audioEngine.setCrossfadeSeconds(nextSettings.crossfadeSeconds);
      audioEngine.setEqualizer(nextSettings.eqEnabled, nextSettings.eqBands);
    });
    api.onDesktopLyricsState((open) => {
      set({ isDesktopLyricsOpen: open });
      if (open) {
        api.syncDesktopLyrics(buildDesktopLyricsPayload(get()));
      }
    });
    api.onMediaKey((cmd) => {
      if (cmd === 'play-pause') void get().togglePlayPause();
      else if (cmd === 'next') void get().nextTrack(false);
      else if (cmd === 'prev') void get().prevTrack();
    });

    if (!desktopSyncInterval) {
      desktopSyncInterval = setInterval(() => {
        const st = get();
        if (!st.isDesktopLyricsOpen) return;
        api.syncDesktopLyrics(buildDesktopLyricsPayload(st));
      }, 55);
    }

    await get().refreshDiscover();
  },

  refreshDiscover: async () => {
    set({ discoverLoading: true });
    try {
      const feed = await window.aetherAPI.getDiscoverFeed();
      set({ discoverFeed: feed, discoverLoading: false });
    } catch {
      set({ discoverLoading: false });
    }
  },

  setView: (view) => set({ activeView: view }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),

  openAlbum: async (albumId, previewAlbum) => {
    set({
      activeView: 'album',
      selectedAlbumId: albumId,
      selectedAlbum: previewAlbum ?? null,
      albumLoading: true,
    });
    try {
      const full = await window.aetherAPI.getAlbumDetails(albumId);
      if (full) {
        set({ selectedAlbum: full, albumLoading: false });
      } else {
        set({ albumLoading: false });
      }
    } catch {
      set({ albumLoading: false });
    }
  },

  openPlaylist: (playlistId) =>
    set({ activeView: 'playlist', selectedPlaylistId: playlistId }),

  playTrack: async (track, newContextTracks, opts = {}) => {
    const state = get();
    const {
      useCrossfade = false,
      contextName,
      fromPriority = false,
      fromHistory = false,
      skipHistoryPush = false,
    } = opts;

    let nextHistory = state.playHistory;
    if (!fromHistory && !skipHistoryPush && state.currentTrack && state.currentTrack.id !== track.id) {
      nextHistory = [...state.playHistory, state.currentTrack].slice(-50);
    }

    let nextContextQueue = state.contextQueue;
    let nextOriginalQueue = state.originalContextQueue;
    let nextContextIdx = state.contextIndex;
    let nextContextName = contextName ?? state.contextName;

    if (newContextTracks && newContextTracks.length > 0) {
      nextOriginalQueue = [...newContextTracks];
      if (!contextName) {
        nextContextName = track.album || state.t().nav.discover;
      }

      if (state.shuffle) {
        const remaining = newContextTracks.filter((t) => t.id !== track.id);
        nextContextQueue = [track, ...fisherYates(remaining)];
        nextContextIdx = 0;
      } else {
        nextContextQueue = [...newContextTracks];
        const idx = nextContextQueue.findIndex((t) => t.id === track.id);
        if (idx >= 0) {
          nextContextIdx = idx;
        } else {
          nextContextQueue.unshift(track);
          nextContextIdx = 0;
        }
      }
    } else if (!fromPriority && !fromHistory) {
      const foundIdx = state.contextQueue.findIndex((t) => t.id === track.id);
      if (foundIdx >= 0) {
        nextContextIdx = foundIdx;
      } else if (state.contextQueue.length === 0) {
        nextOriginalQueue = [track];
        nextContextQueue = [track];
        nextContextIdx = 0;
        nextContextName = track.album || state.t().nav.discover;
      }
    }

    const reqId = ++latestPlayReqId;
    audioEngine.setPendingTrack(track.id, useCrossfade);

    set({
      playHistory: nextHistory,
      contextQueue: nextContextQueue,
      originalContextQueue: nextOriginalQueue,
      contextIndex: nextContextIdx,
      contextName: nextContextName,
      isRightPanelOpen: state.currentTrack === null ? true : state.isRightPanelOpen,
      currentTrack: track,
      isPlaying: useCrossfade ? state.isPlaying : false,
      isLoadingStream: true,
      streamError: null,
      lyricsLoading: true,
      lyricsPayload: null,
      currentMv: null,
      isMvOpen: false,
      mvStream: null,
      mvLoading: false,
      mvError: null,
    });

    void extractAmbientPalette(track.coverUrl).then((palette) => {
      if (reqId === latestPlayReqId) {
        set({ ambientPalette: palette });
      }
    });

    try {
      const resolved = await window.aetherAPI.resolveStream(track);
      if (reqId !== latestPlayReqId) return;

      void window.aetherAPI.checkTrackMv(track, resolved.youtubeId).then((mv) => {
        if (reqId === latestPlayReqId) {
          set({ currentMv: mv });
        }
      });

      const knownDur = resolved.actualDuration || track.duration;
      void window.aetherAPI.getLyrics(track, knownDur).then((lyrics) => {
        if (reqId === latestPlayReqId) {
          set({ lyricsPayload: lyrics, lyricsLoading: false });
          if (get().isDesktopLyricsOpen) {
            window.aetherAPI.syncDesktopLyrics(buildDesktopLyricsPayload(get()));
          }
        }
      });

      await audioEngine.playTrack(resolved.url, track, useCrossfade);
      if (reqId !== latestPlayReqId) return;

      set({ isPlaying: true, isLoadingStream: false });

      if (get().isDesktopLyricsOpen) {
        window.aetherAPI.syncDesktopLyrics(buildDesktopLyricsPayload(get()));
      }

      setTimeout(() => {
        if (reqId !== latestPlayReqId) return;
        const audioDurSec = Math.round(audioEngine.getCurrentSnapshot().durationMs / 1000);
        if (audioDurSec > 15 && (!knownDur || Math.abs(audioDurSec - knownDur) > 6)) {
          void window.aetherAPI.getLyrics(track, audioDurSec).then((betterLyrics) => {
            if (reqId === latestPlayReqId) {
              set({ lyricsPayload: betterLyrics, lyricsLoading: false });
            }
          });
        }
      }, 1500);

      void window.aetherAPI.recordPlay(track).then((recent) => {
        set({ recentlyPlayed: recent });
      });

      const upcoming = peekNextTrack(get());
      if (upcoming) {
        void window.aetherAPI.prefetchStream(upcoming);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to play track';
      if (reqId === latestPlayReqId) {
        audioEngine.stopAll();
        set({ isLoadingStream: false, isPlaying: false, lyricsLoading: false, streamError: msg });
      }
    }
  },

  togglePlayPause: async () => {
    const state = get();
    if (!state.currentTrack || state.isLoadingStream) return;
    const nextPlaying = !audioEngine.isPlaying();
    await audioEngine.setPlaying(nextPlaying);
    set({ isPlaying: nextPlaying });
    if (get().isDesktopLyricsOpen) {
      window.aetherAPI.syncDesktopLyrics(buildDesktopLyricsPayload(get()));
    }
  },

  nextTrack: async (viaCrossfade = false) => {
    const state = get();

    // 1. Explicit priority queue items play before context queue
    if (state.priorityQueue.length > 0) {
      const [nextItem, ...rest] = state.priorityQueue;
      set({ priorityQueue: rest });
      await state.playTrack(nextItem, undefined, {
        useCrossfade: viaCrossfade,
        fromPriority: true,
      });
      return;
    }

    // 2. Context queue progression
    if (state.contextQueue.length === 0) {
      set({ isPlaying: false });
      return;
    }

    const nextIdx = state.contextIndex + 1;
    if (nextIdx < state.contextQueue.length) {
      const next = state.contextQueue[nextIdx];
      set({ contextIndex: nextIdx });
      await state.playTrack(next, undefined, { useCrossfade: viaCrossfade });
      return;
    }

    // 3. Wrap around on Repeat All (re-shuffle deck if shuffle is active)
    if (state.repeat === 'all') {
      if (state.shuffle) {
        const reshuffled = fisherYates(state.originalContextQueue);
        set({ contextQueue: reshuffled, contextIndex: 0 });
        if (reshuffled[0]) {
          await state.playTrack(reshuffled[0], undefined, { useCrossfade: viaCrossfade });
        }
      } else {
        set({ contextIndex: 0 });
        if (state.contextQueue[0]) {
          await state.playTrack(state.contextQueue[0], undefined, { useCrossfade: viaCrossfade });
        }
      }
      return;
    }

    set({ isPlaying: false });
  },

  prevTrack: async () => {
    const state = get();
    const snap = audioEngine.getCurrentSnapshot();
    if (snap.currentTimeMs > 3500) {
      audioEngine.seek(0);
      return;
    }

    if (state.playHistory.length > 0) {
      const prev = state.playHistory[state.playHistory.length - 1];
      const nextHist = state.playHistory.slice(0, -1);
      const idxInContext = state.contextQueue.findIndex((t) => t.id === prev.id);

      set({
        playHistory: nextHist,
        contextIndex: idxInContext >= 0 ? idxInContext : state.contextIndex,
      });
      await state.playTrack(prev, undefined, { fromHistory: true, skipHistoryPush: true });
      return;
    }

    if (state.contextQueue.length === 0) return;
    const prevIdx =
      state.contextIndex > 0
        ? state.contextIndex - 1
        : state.repeat === 'all'
          ? state.contextQueue.length - 1
          : 0;
    const prev = state.contextQueue[prevIdx];
    if (prev) {
      set({ contextIndex: prevIdx });
      await state.playTrack(prev, undefined, { fromHistory: true, skipHistoryPush: true });
    }
  },

  playNextInQueue: (track) => {
    const state = get();
    const t = state.t();
    if (!state.currentTrack) {
      void state.playTrack(track, [track]);
      return;
    }
    set({ priorityQueue: [{ ...track }, ...state.priorityQueue] });
    state.showToast(t.toast.queuedNext);
  },

  addToQueue: (track) => {
    const state = get();
    const t = state.t();
    if (!state.currentTrack) {
      void state.playTrack(track, [track]);
      return;
    }
    set({ priorityQueue: [...state.priorityQueue, { ...track }] });
    state.showToast(t.toast.queuedEnd);
  },

  reorderPriorityQueue: (nextList) => set({ priorityQueue: nextList }),

  removeFromPriorityQueue: (index) =>
    set((s) => ({
      priorityQueue: s.priorityQueue.filter((_, i) => i !== index),
    })),

  clearPriorityQueue: () => set({ priorityQueue: [] }),

  reorderUpcomingContext: (nextUpcoming) =>
    set((s) => {
      const head = s.contextQueue.slice(0, s.contextIndex + 1);
      return { contextQueue: [...head, ...nextUpcoming] };
    }),

  removeFromUpcomingContext: (upcomingIdx) =>
    set((s) => {
      const targetIdx = s.contextIndex + 1 + upcomingIdx;
      return {
        contextQueue: s.contextQueue.filter((_, i) => i !== targetIdx),
      };
    }),

  jumpToQueueItem: async (source, idx) => {
    const state = get();
    if (source === 'priority') {
      const picked = state.priorityQueue[idx];
      if (!picked) return;
      const remaining = state.priorityQueue.slice(idx + 1);
      set({ priorityQueue: remaining });
      await state.playTrack(picked, undefined, { fromPriority: true });
      return;
    }

    const targetIdx = state.contextIndex + 1 + idx;
    const picked = state.contextQueue[targetIdx];
    if (!picked) return;
    set({ contextIndex: targetIdx });
    await state.playTrack(picked);
  },

  toggleShuffle: () =>
    set((s) => {
      const nextShuffle = !s.shuffle;
      if (s.originalContextQueue.length === 0) {
        return { shuffle: nextShuffle };
      }

      if (nextShuffle) {
        const cur = s.currentTrack;
        const pool = cur
          ? s.originalContextQueue.filter((t) => t.id !== cur.id)
          : s.originalContextQueue;
        const shuffled = cur ? [cur, ...fisherYates(pool)] : fisherYates(pool);
        return {
          shuffle: true,
          contextQueue: shuffled,
          contextIndex: 0,
        };
      }

      const restoredIdx = s.currentTrack
        ? Math.max(
            0,
            s.originalContextQueue.findIndex((t) => t.id === s.currentTrack!.id)
          )
        : 0;
      return {
        shuffle: false,
        contextQueue: [...s.originalContextQueue],
        contextIndex: restoredIdx,
      };
    }),

  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
    })),

  setVolume: (vol, muted) => {
    const nextMuted = typeof muted === 'boolean' ? muted : get().muted;
    audioEngine.setVolume(vol, nextMuted);
    set({ volume: vol, muted: nextMuted });
  },

  setSleepTimer: (choice) => {
    if (sleepInterval) {
      clearInterval(sleepInterval);
      sleepInterval = null;
    }
    audioEngine.setSleepAttenuation(1);

    if (choice === null) {
      set({ sleepTimer: { mode: 'off', remainingSec: 0 } });
      return;
    }

    if (choice === 'end-of-track') {
      set({ sleepTimer: { mode: 'end-of-track', remainingSec: 0 } });
      return;
    }

    const totalSec = Math.round(choice * 60);
    set({ sleepTimer: { mode: 'minutes', remainingSec: totalSec } });

    sleepInterval = setInterval(() => {
      const cur = get().sleepTimer;
      if (cur.mode !== 'minutes') {
        if (sleepInterval) clearInterval(sleepInterval);
        return;
      }
      const nextSec = cur.remainingSec - 1;
      if (nextSec <= 8 && nextSec > 0) {
        audioEngine.setSleepAttenuation(nextSec / 8);
      }
      if (nextSec <= 0) {
        if (sleepInterval) clearInterval(sleepInterval);
        sleepInterval = null;
        void audioEngine.setPlaying(false);
        audioEngine.setSleepAttenuation(1);
        set({ isPlaying: false, sleepTimer: { mode: 'off', remainingSec: 0 } });
      } else {
        set({ sleepTimer: { mode: 'minutes', remainingSec: nextSec } });
      }
    }, 1000);
  },

  setImmersiveLyricsOpen: (open) => set({ isImmersiveLyricsOpen: open }),

  toggleDesktopLyrics: async () => {
    const next = await window.aetherAPI.toggleDesktopLyrics();
    set({ isDesktopLyricsOpen: next });
    if (next) {
      window.aetherAPI.syncDesktopLyrics(buildDesktopLyricsPayload(get()));
    }
  },

  selectLyricCandidate: (candidateId) => {
    const payload = get().lyricsPayload;
    if (!payload?.candidates) return;
    const picked = payload.candidates.find((c) => c.id === candidateId);
    if (!picked) return;
    set({
      lyricsPayload: {
        ...payload,
        lines: picked.lines,
        plainText: picked.lines.map((l) => l.text).join('\n'),
        selectedCandidateId: picked.id,
      },
    });
  },

  openMvModal: async () => {
    const state = get();
    const mv = state.currentMv;
    if (!mv) return;

    if (state.isPlaying) {
      await audioEngine.setPlaying(false);
      set({ isPlaying: false });
      if (get().isDesktopLyricsOpen) {
        window.aetherAPI.syncDesktopLyrics(buildDesktopLyricsPayload(get()));
      }
    }

    set({
      isMvOpen: true,
      mvLoading: true,
      mvError: null,
      mvStream: null,
    });

    try {
      const stream = await window.aetherAPI.resolveMvStream(mv.youtubeId);
      if (get().currentMv?.youtubeId === mv.youtubeId && get().isMvOpen) {
        set({ mvStream: stream, mvLoading: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : get().t().mv.error;
      if (get().isMvOpen) {
        set({ mvLoading: false, mvError: msg });
      }
    }
  },

  closeMvModal: () => set({ isMvOpen: false, mvLoading: false }),

  setEqOpen: (open) => set({ isEqOpen: open }),
  setQueueOpen: (open) => set({ isQueueOpen: open }),
  openAddToPlaylistModal: (track) =>
    set({ isPlaylistModalOpen: true, trackToAddToPlaylist: track }),
  closeAddToPlaylistModal: () =>
    set({ isPlaylistModalOpen: false, trackToAddToPlaylist: null }),
  openCreatePlaylistModal: (playlistToEdit) =>
    set({ isCreatePlaylistModalOpen: true, editingPlaylist: playlistToEdit ?? null }),
  closeCreatePlaylistModal: () =>
    set({ isCreatePlaylistModalOpen: false, editingPlaylist: null }),
  openTrackContextMenu: (x, y, track, queueContext) =>
    set({ contextMenu: { x, y, track, queueContext } }),
  closeTrackContextMenu: () => set({ contextMenu: null }),

  toggleFavorite: async (track) => {
    const wasFav = get().favorites.some((f) => f.id === track.id);
    const favorites = await window.aetherAPI.toggleFavorite(track);
    set({ favorites });
    const t = get().t();
    get().showToast(wasFav ? t.toast.likedRemoved : t.toast.likedAdded);
  },

  createPlaylist: async (name, description = '') => {
    if (!name.trim()) return null;
    const playlists = await window.aetherAPI.createPlaylist(name.trim(), description.trim());
    set({ playlists });
    const created = playlists[0] ?? null;
    if (created) {
      get().showToast(get().t().toast.playlistCreated.replace('{name}', created.name));
    }
    return created;
  },

  updatePlaylist: async (playlistId, patch) => {
    const playlists = await window.aetherAPI.updatePlaylist(playlistId, patch);
    set({ playlists });
    get().showToast(get().t().toast.playlistUpdated);
  },

  reorderPlaylistTracks: async (playlistId, orderedIds) => {
    const playlists = await window.aetherAPI.reorderPlaylistTracks(playlistId, orderedIds);
    set({ playlists });
  },

  addTrackToPlaylist: async (playlistId, track, playlistName) => {
    const playlists = await window.aetherAPI.addTrackToPlaylist(playlistId, track);
    set({ playlists });
    const name = playlistName || playlists.find((p) => p.id === playlistId)?.name || 'Playlist';
    get().showToast(get().t().toast.addedToPlaylist.replace('{name}', name));
  },

  removeTrackFromPlaylist: async (playlistId, trackId, playlistName) => {
    const playlists = await window.aetherAPI.removeTrackFromPlaylist(playlistId, trackId);
    set({ playlists });
    const name = playlistName || playlists.find((p) => p.id === playlistId)?.name || 'Playlist';
    get().showToast(get().t().toast.removedFromPlaylist.replace('{name}', name));
  },

  deletePlaylist: async (playlistId) => {
    const playlists = await window.aetherAPI.deletePlaylist(playlistId);
    set((s) => ({
      playlists,
      activeView:
        s.activeView === 'playlist' && s.selectedPlaylistId === playlistId
          ? 'discover'
          : s.activeView,
    }));
  },

  enqueueDownloads: async (tracks, albumTitle) => {
    const downloads = await window.aetherAPI.enqueueDownloads(tracks, albumTitle);
    set({ downloads });
  },

  cancelDownload: async (taskId) => {
    const downloads = await window.aetherAPI.cancelDownload(taskId);
    set({ downloads });
  },

  retryDownload: async (taskId) => {
    const downloads = await window.aetherAPI.retryDownload(taskId);
    set({ downloads });
  },

  clearCompletedDownloads: async () => {
    const downloads = await window.aetherAPI.clearCompletedDownloads();
    set({ downloads });
  },

  updateSettings: async (patch) => {
    const updated = await window.aetherAPI.updateSettings(patch);
    set({ settings: updated });
    audioEngine.setCrossfadeSeconds(updated.crossfadeSeconds);
    audioEngine.setEqualizer(updated.eqEnabled, updated.eqBands);
  },

  adjustLyricOffset: async (trackId, deltaMs) => {
    const current = get().settings.lyricOffsets[trackId] ?? 0;
    const next = current + deltaMs;
    const updated = await window.aetherAPI.setLyricOffset(trackId, next);
    set({ settings: updated });
  },

  setLyricOffsetExact: async (trackId, exactOffsetMs) => {
    const updated = await window.aetherAPI.setLyricOffset(trackId, exactOffsetMs);
    set({ settings: updated });
  },

  addLocalFolder: async () => {
    const localTracks = await window.aetherAPI.addLocalFolder();
    const snap = await window.aetherAPI.getLibrarySnapshot();
    applyLibrarySnapshot({ ...snap, localTracks }, set);
  },

  rescanLocalFolders: async () => {
    const localTracks = await window.aetherAPI.rescanLocalFolders();
    set({ localTracks });
  },

  removeLocalFolder: (folder) =>
    window.aetherAPI.removeLocalFolder(folder).then(async (localTracks) => {
      const snap = await window.aetherAPI.getLibrarySnapshot();
      applyLibrarySnapshot({ ...snap, localTracks }, set);
    }),

  pickDownloadDir: async () => {
    const updated = await window.aetherAPI.pickDownloadDir();
    set({ settings: updated });
  },
}));
