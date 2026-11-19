import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from 'electron';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import {
  AppSettings,
  DesktopIslandBounds,
  DesktopLyricsSyncPayload,
  Track,
  YouTubeBrowserId,
} from '../src/types/music';
import { mediaServer } from './services/mediaServer';
import { libraryStore } from './services/store';
import {
  getAlbumDetails,
  getDiscoverFeed,
  parseUrlBatch,
  searchCatalog,
  searchYouTubeMusic,
} from './services/catalogService';
import { prefetchTrackStream, resolveTrackStream } from './services/streamService';
import { checkOfficialMv, resolveMvStream } from './services/mvService';
import { getLyrics } from './services/lyricsService';
import { downloadManager } from './services/downloadManager';
import { scanFolders } from './services/libraryScanner';
import { resolveYtDlp, terminateAllBinaries } from './services/binaryManager';
import {
  detectDefaultSystemBrowser,
  loginSpotifyWindow,
  loginYouTubeInBrowser,
  logoutSpotify,
  logoutYouTube,
  pickYouTubeCookieFile,
  verifyYouTubeAuth,
} from './services/authService';

let mainWin: BrowserWindow | null = null;
let desktopLyricsWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let quitStarted = false;
let latestLyricsPayload: DesktopLyricsSyncPayload | null = null;

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.setAppUserModelId('com.aetherstudio.music');
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'AetherMusicDesktop'));
} catch {
  // Fallback to default userData
}

const ISLAND_WIN_W = 760;
const ISLAND_WIN_H = 230;
let currentIslandBounds: DesktopIslandBounds = {
  x: 158,
  y: 42,
  width: 444,
  height: 54,
  radius: 27,
};

function buildRoundedShapeRects(b: DesktopIslandBounds): Electron.Rectangle[] {
  const sx = Math.max(0, Math.min(ISLAND_WIN_W - 40, Math.round(b.x)));
  const sy = Math.max(36, Math.min(ISLAND_WIN_H - 30, Math.round(b.y)));
  const sw = Math.max(40, Math.min(ISLAND_WIN_W - sx, Math.round(b.width)));
  const sh = Math.max(30, Math.min(ISLAND_WIN_H - sy, Math.round(b.height)));
  const rawRadius = typeof b.radius === 'number' ? b.radius : Math.floor(sh / 2);
  const sr = Math.max(0, Math.min(Math.round(rawRadius), Math.floor(sh / 2), Math.floor(sw / 2)));

  if (sr <= 0) {
    return [{ x: sx, y: sy, width: sw, height: sh }];
  }

  const rects: Electron.Rectangle[] = [];
  for (let row = 0; row < sr; row++) {
    const dy = sr - (row + 0.5);
    const dx = Math.sqrt(Math.max(0, sr * sr - dy * dy));
    const inset = Math.max(0, Math.floor(sr - dx));
    rects.push({
      x: sx + inset,
      y: sy + row,
      width: Math.max(2, sw - inset * 2),
      height: 1,
    });
  }

  if (sh > sr * 2) {
    rects.push({ x: sx, y: sy + sr, width: sw, height: sh - sr * 2 });
  }

  for (let row = 0; row < sr; row++) {
    const dy = row + 0.5;
    const dx = Math.sqrt(Math.max(0, sr * sr - dy * dy));
    const inset = Math.max(0, Math.floor(sr - dx));
    rects.push({
      x: sx + inset,
      y: sy + sh - sr + row,
      width: Math.max(2, sw - inset * 2),
      height: 1,
    });
  }

  return rects;
}

function applyDesktopIslandShape(bounds?: DesktopIslandBounds): void {
  if (bounds) {
    currentIslandBounds = { ...bounds };
  }
  if (!desktopLyricsWin || desktopLyricsWin.isDestroyed()) return;
  try {
    desktopLyricsWin.setShape(buildRoundedShapeRects(currentIslandBounds));
  } catch {
    // Ignore if platform does not support setShape
  }
}

function encodePngRgba(width: number, height: number, rgba: Buffer): Buffer {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const makeChunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crcBuf]);
  };

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createAppIcon(): Electron.NativeImage {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const r = 7;
      const box = Math.max(dx - (cx - r), 0) ** 2 + Math.max(dy - (cy - r), 0) ** 2;
      if (Math.max(dx - (cx - r), dy - (cy - r)) > 0 && box > r * r) {
        buf[idx + 3] = 0;
        continue;
      }

      const dist = Math.hypot(x - cx, y - cy);
      const t = (x + y) / (size * 2);
      let red = Math.round(18 + t * 24);
      let green = Math.round(20 + t * 18);
      let blue = Math.round(42 + t * 48);

      if (dist > 9.2 && dist < 11.4) {
        red = Math.round(115 + t * 90);
        green = Math.round(135 + t * 100);
        blue = 255;
      }

      const bar1 = Math.abs(x - 11.5) <= 1.1 && Math.abs(y - 16) <= 4.5;
      const bar2 = Math.abs(x - 16) <= 1.1 && Math.abs(y - 16) <= 7.5;
      const bar3 = Math.abs(x - 20.5) <= 1.1 && Math.abs(y - 16) <= 5.2;
      if (bar1 || bar2 || bar3) {
        red = 245;
        green = 248;
        blue = 255;
      }

      buf[idx] = red;
      buf[idx + 1] = green;
      buf[idx + 2] = blue;
      buf[idx + 3] = 255;
    }
  }

  return nativeImage.createFromBuffer(encodePngRgba(size, size, buf));
}

function resolveAppIcon(): Electron.NativeImage {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(app.getAppPath(), 'resources', 'icon.ico'),
    path.join(process.cwd(), 'resources', 'icon.ico'),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }
  return createAppIcon();
}

function quitApplicationCompletely(): void {
  if (quitStarted) return;
  quitStarted = true;
  isQuitting = true;

  try {
    globalShortcut.unregisterAll();
  } catch {
    // Ignore
  }
  downloadManager.shutdown();
  terminateAllBinaries();
  mediaServer.stop();

  if (tray) {
    try {
      tray.destroy();
    } catch {
      // Ignore
    }
    tray = null;
  }

  if (desktopLyricsWin && !desktopLyricsWin.isDestroyed()) {
    desktopLyricsWin.destroy();
  }
  desktopLyricsWin = null;

  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.destroy();
  }
  mainWin = null;

  app.quit();
  setTimeout(() => {
    app.exit(0);
  }, 400).unref();
}

function getRendererEntryUrl(hash?: string): {
  devUrl?: string;
  filePath?: string;
  query?: Record<string, string>;
  hash?: string;
} {
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    const base = devServer.replace(/\/$/, '');
    if (hash === 'desktop-lyrics') {
      return { devUrl: `${base}/?window=desktop-lyrics#desktop-lyrics` };
    }
    return { devUrl: hash ? `${base}#${hash}` : base };
  }
  return {
    filePath: path.join(__dirname, '..', 'dist', 'index.html'),
    query: hash === 'desktop-lyrics' ? { window: 'desktop-lyrics' } : undefined,
    hash,
  };
}

function createMainWindow(showWhenReady = true): void {
  const icon = resolveAppIcon();
  mainWin = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    backgroundColor: '#07080C',
    show: false,
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  const entry = getRendererEntryUrl();
  if (entry.devUrl) {
    void mainWin.loadURL(entry.devUrl);
  } else if (entry.filePath) {
    void mainWin.loadFile(entry.filePath);
  }

  mainWin.once('ready-to-show', () => {
    if (showWhenReady) {
      mainWin?.show();
    }
  });

  mainWin.on('maximize', () => {
    mainWin?.webContents.send('window:maximized', true);
  });

  mainWin.on('unmaximize', () => {
    mainWin?.webContents.send('window:maximized', false);
  });

  mainWin.on('close', (e) => {
    if (isQuitting) return;
    if (libraryStore.getSettings().minimizeToTray) {
      e.preventDefault();
      mainWin?.hide();
    } else {
      e.preventDefault();
      quitApplicationCompletely();
    }
  });

  mainWin.on('closed', () => {
    mainWin = null;
    if (desktopLyricsWin && !desktopLyricsWin.isDestroyed()) {
      desktopLyricsWin.destroy();
      desktopLyricsWin = null;
    }
    if (!libraryStore.getSettings().minimizeToTray) {
      quitApplicationCompletely();
    }
  });
}

function toggleDesktopLyricsWindow(forceState?: boolean): boolean {
  const shouldOpen =
    typeof forceState === 'boolean'
      ? forceState
      : !(desktopLyricsWin && !desktopLyricsWin.isDestroyed());

  if (!shouldOpen) {
    if (desktopLyricsWin && !desktopLyricsWin.isDestroyed()) {
      desktopLyricsWin.close();
      desktopLyricsWin = null;
    }
    mainWin?.webContents.send('lyrics:desktop-state', false);
    rebuildTrayMenu();
    return false;
  }

  if (desktopLyricsWin && !desktopLyricsWin.isDestroyed()) {
    desktopLyricsWin.show();
    mainWin?.webContents.send('lyrics:desktop-state', true);
    rebuildTrayMenu();
    return true;
  }

  const display = screen.getPrimaryDisplay().workArea;
  const x = display.x + Math.round((display.width - ISLAND_WIN_W) / 2);
  const y = display.y - 28;

  currentIslandBounds = { x: 158, y: 42, width: 444, height: 54, radius: 27 };

  desktopLyricsWin = new BrowserWindow({
    width: ISLAND_WIN_W,
    height: ISLAND_WIN_H,
    x,
    y,
    title: '',
    frame: false,
    transparent: true,
    thickFrame: false,
    roundedCorners: false,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  applyDesktopIslandShape();
  desktopLyricsWin.setAlwaysOnTop(true, 'screen-saver');
  desktopLyricsWin.on('page-title-updated', (e) => e.preventDefault());
  desktopLyricsWin.on('blur', () => applyDesktopIslandShape());
  desktopLyricsWin.on('focus', () => applyDesktopIslandShape());

  if (process.platform === 'win32') {
    desktopLyricsWin.hookWindowMessage(0x0083, () => {});
    desktopLyricsWin.hookWindowMessage(0x0085, () => {});
  }

  const locked = libraryStore.getSettings().desktopLyricsLocked;
  if (locked) {
    desktopLyricsWin.setIgnoreMouseEvents(true, { forward: true });
  }

  const entry = getRendererEntryUrl('desktop-lyrics');
  if (entry.devUrl) {
    void desktopLyricsWin.loadURL(entry.devUrl);
  } else if (entry.filePath) {
    void desktopLyricsWin.loadFile(entry.filePath, {
      query: entry.query,
      hash: 'desktop-lyrics',
    });
  }

  desktopLyricsWin.webContents.once('did-finish-load', () => {
    if (!desktopLyricsWin || desktopLyricsWin.isDestroyed()) return;
    applyDesktopIslandShape();
    if (latestLyricsPayload) {
      desktopLyricsWin.webContents.send('lyrics:desktop-sync', latestLyricsPayload);
    }
    desktopLyricsWin.showInactive();
  });

  desktopLyricsWin.on('closed', () => {
    desktopLyricsWin = null;
    mainWin?.webContents.send('lyrics:desktop-state', false);
    rebuildTrayMenu();
  });

  mainWin?.webContents.send('lyrics:desktop-state', true);
  rebuildTrayMenu();
  return true;
}

function setDesktopLyricsLocked(locked: boolean): AppSettings {
  const updated = libraryStore.updateSettings({ desktopLyricsLocked: locked });
  if (desktopLyricsWin && !desktopLyricsWin.isDestroyed()) {
    desktopLyricsWin.setIgnoreMouseEvents(locked, { forward: true });
    desktopLyricsWin.webContents.send('lyrics:desktop-lock-state', locked);
  }
  mainWin?.webContents.send('settings:updated', updated);
  rebuildTrayMenu();
  return updated;
}

function rebuildTrayMenu(): void {
  if (!tray) return;
  const settings = libraryStore.getSettings();
  const isVi = settings.language === 'vi';
  const lyricsOpen = Boolean(desktopLyricsWin && !desktopLyricsWin.isDestroyed());

  const menu = Menu.buildFromTemplate([
    {
      label: isVi ? 'Mở Aether Music' : 'Open Aether Music',
      click: () => {
        if (mainWin) {
          mainWin.show();
          mainWin.focus();
        } else {
          createMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: isVi ? 'Phát / Tạm dừng' : 'Play / Pause',
      click: () => mainWin?.webContents.send('player:media-key', 'play-pause'),
    },
    {
      label: isVi ? 'Bài tiếp theo' : 'Next Track',
      click: () => mainWin?.webContents.send('player:media-key', 'next'),
    },
    {
      label: isVi ? 'Bài trước' : 'Previous Track',
      click: () => mainWin?.webContents.send('player:media-key', 'prev'),
    },
    { type: 'separator' },
    {
      label: lyricsOpen
        ? isVi
          ? 'Ẩn Lời nổi Desktop'
          : 'Hide Floating Desktop Lyrics'
        : isVi
          ? 'Hiện Lời nổi Desktop'
          : 'Show Floating Desktop Lyrics',
      click: () => toggleDesktopLyricsWindow(),
    },
    {
      label: settings.desktopLyricsLocked
        ? isVi
          ? 'Mở khóa Lời nổi Desktop'
          : 'Unlock Floating Lyrics'
        : isVi
          ? 'Khóa xuyên chuột Lời nổi'
          : 'Lock Floating Lyrics Click-Through',
      click: () => setDesktopLyricsLocked(!settings.desktopLyricsLocked),
    },
    { type: 'separator' },
    {
      label: isVi ? 'Thoát hoàn toàn' : 'Quit Aether Music',
      click: () => {
        quitApplicationCompletely();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function setupTrayAndShortcuts(): void {
  tray = new Tray(resolveAppIcon());
  tray.setToolTip('Aether Music');
  tray.on('double-click', () => {
    if (mainWin) {
      mainWin.show();
      mainWin.focus();
    }
  });
  rebuildTrayMenu();

  try {
    globalShortcut.register('MediaPlayPause', () => {
      mainWin?.webContents.send('player:media-key', 'play-pause');
    });
    globalShortcut.register('MediaNextTrack', () => {
      mainWin?.webContents.send('player:media-key', 'next');
    });
    globalShortcut.register('MediaPreviousTrack', () => {
      mainWin?.webContents.send('player:media-key', 'prev');
    });
  } catch {
    // Some systems reserve media keys for hardware drivers
  }
}

function registerIpcHandlers(): void {
  // Media port & Window controls
  ipcMain.handle('app:media-port', () => mediaServer.getPort());
  ipcMain.handle('window:minimize', () => mainWin?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWin) return false;
    if (mainWin.isMaximized()) {
      mainWin.unmaximize();
      return false;
    }
    mainWin.maximize();
    return true;
  });
  ipcMain.handle('window:close', () => {
    if (libraryStore.getSettings().minimizeToTray) {
      mainWin?.hide();
    } else {
      quitApplicationCompletely();
    }
  });

  // Catalog & Search
  ipcMain.handle('catalog:discover', () => getDiscoverFeed());
  ipcMain.handle('catalog:search', (_e, query: string) => searchCatalog(query));
  ipcMain.handle('catalog:album', (_e, albumId: string) => getAlbumDetails(albumId));
  ipcMain.handle('catalog:search-yt', (_e, query: string) => searchYouTubeMusic(query));
  ipcMain.handle('catalog:parse-url', (_e, url: string) => parseUrlBatch(url));

  // Streaming, MV & Lyrics
  ipcMain.handle('stream:resolve', (_e, track: Track) => resolveTrackStream(track));
  ipcMain.handle('stream:prefetch', (_e, track: Track) => prefetchTrackStream(track));
  ipcMain.handle('mv:check', (_e, track: Track, audioYoutubeId?: string) =>
    checkOfficialMv(track, audioYoutubeId)
  );
  ipcMain.handle('mv:resolve', (_e, youtubeId: string) => resolveMvStream(youtubeId));
  ipcMain.handle('lyrics:get', (_e, track: Track, actualDuration?: number) =>
    getLyrics(track, actualDuration)
  );
  ipcMain.handle('lyrics:get-desktop-initial', () => latestLyricsPayload);
  ipcMain.handle('lyrics:set-offset', (_e, trackId: string, offsetMs: number) =>
    libraryStore.setLyricOffset(trackId, offsetMs)
  );
  ipcMain.handle('lyrics:toggle-desktop', (_e, force?: boolean) =>
    toggleDesktopLyricsWindow(force)
  );
  ipcMain.handle('lyrics:set-lock', (_e, locked: boolean) => setDesktopLyricsLocked(locked));
  ipcMain.on('lyrics:sync-desktop', (_e, payload: DesktopLyricsSyncPayload) => {
    latestLyricsPayload = payload;
    if (desktopLyricsWin && !desktopLyricsWin.isDestroyed()) {
      desktopLyricsWin.webContents.send('lyrics:desktop-sync', payload);
    }
  });
  ipcMain.on('desktop-lyrics:command', (_e, cmd: string) => {
    if (cmd === 'unlock') {
      setDesktopLyricsLocked(false);
    } else if (cmd === 'close') {
      toggleDesktopLyricsWindow(false);
    } else {
      mainWin?.webContents.send('player:media-key', cmd);
    }
  });
  ipcMain.on('desktop-lyrics:move-by', (_e, dx: number, dy: number) => {
    if (!desktopLyricsWin || desktopLyricsWin.isDestroyed()) return;
    const [cx, cy] = desktopLyricsWin.getPosition();
    desktopLyricsWin.setPosition(Math.round(cx + dx), Math.round(cy + dy));
  });
  ipcMain.on('desktop-lyrics:set-island-bounds', (_e, bounds: DesktopIslandBounds) => {
    applyDesktopIslandShape(bounds);
  });

  // Downloads
  ipcMain.handle('downloads:list', () => downloadManager.getTasks());
  ipcMain.handle('downloads:enqueue', (_e, tracks: Track[], albumTitle?: string) =>
    downloadManager.enqueueTracks(tracks, albumTitle)
  );
  ipcMain.handle('downloads:cancel', (_e, taskId: string) => downloadManager.cancelTask(taskId));
  ipcMain.handle('downloads:retry', (_e, taskId: string) => downloadManager.retryTask(taskId));
  ipcMain.handle('downloads:clear', () => downloadManager.clearCompleted());

  // Library & Playlists
  ipcMain.handle('library:snapshot', () => libraryStore.getSnapshot());
  ipcMain.handle('library:toggle-favorite', (_e, track: Track) =>
    libraryStore.toggleFavorite(track)
  );
  ipcMain.handle('library:record-play', (_e, track: Track) => libraryStore.recordPlay(track));
  ipcMain.handle('library:playlist-create', (_e, name: string, description?: string) =>
    libraryStore.createPlaylist(name, description)
  );
  ipcMain.handle(
    'library:playlist-update',
    (_e, playlistId: string, patch: { name?: string; description?: string }) =>
      libraryStore.updatePlaylist(playlistId, patch)
  );
  ipcMain.handle(
    'library:playlist-reorder',
    (_e, playlistId: string, orderedIds: string[]) =>
      libraryStore.reorderPlaylistTracks(playlistId, orderedIds)
  );
  ipcMain.handle('library:playlist-add-track', (_e, playlistId: string, track: Track) =>
    libraryStore.addTrackToPlaylist(playlistId, track)
  );
  ipcMain.handle('library:playlist-remove-track', (_e, playlistId: string, trackId: string) =>
    libraryStore.removeTrackFromPlaylist(playlistId, trackId)
  );
  ipcMain.handle('library:playlist-delete', (_e, playlistId: string) =>
    libraryStore.deletePlaylist(playlistId)
  );

  // Local folder scanning & Explorer helpers
  ipcMain.handle('library:add-local-folder', async () => {
    if (!mainWin) return libraryStore.getSnapshot().localTracks;
    const res = await dialog.showOpenDialog(mainWin, {
      properties: ['openDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return libraryStore.getSnapshot().localTracks;
    }
    const settings = libraryStore.getSettings();
    const updatedFolders = [...new Set([...settings.localFolders, ...res.filePaths])];
    return scanFolders(updatedFolders);
  });

  ipcMain.handle('library:rescan-local', async () => {
    const settings = libraryStore.getSettings();
    return scanFolders(settings.localFolders);
  });

  ipcMain.handle('library:remove-local-folder', async (_e, folder: string) => {
    const settings = libraryStore.getSettings();
    const updatedFolders = settings.localFolders.filter((f) => f !== folder);
    return scanFolders(updatedFolders);
  });

  ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings>) => {
    const updated = libraryStore.updateSettings(patch);
    if (patch.language) rebuildTrayMenu();
    return updated;
  });

  ipcMain.handle('settings:pick-download-dir', async () => {
    if (!mainWin) return libraryStore.getSettings();
    const res = await dialog.showOpenDialog(mainWin, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: libraryStore.getSettings().downloadDir,
    });
    if (res.canceled || res.filePaths.length === 0) {
      return libraryStore.getSettings();
    }
    return libraryStore.updateSettings({ downloadDir: res.filePaths[0] });
  });

  ipcMain.handle('auth:youtube-detect-browser', () => detectDefaultSystemBrowser());

  ipcMain.handle('auth:youtube-login', async (_e, browser?: YouTubeBrowserId) => {
    const updated = await loginYouTubeInBrowser(browser);
    mainWin?.webContents.send('settings:updated', updated);
    return updated;
  });

  ipcMain.handle('auth:youtube-verify', () => verifyYouTubeAuth());

  ipcMain.handle('auth:youtube-pick-cookies', async () => {
    const updated = await pickYouTubeCookieFile(mainWin);
    mainWin?.webContents.send('settings:updated', updated);
    return updated;
  });

  ipcMain.handle('auth:youtube-logout', async () => {
    const updated = await logoutYouTube();
    mainWin?.webContents.send('settings:updated', updated);
    return updated;
  });

  ipcMain.handle('auth:spotify-login', async () => {
    const updated = await loginSpotifyWindow(mainWin);
    mainWin?.webContents.send('settings:updated', updated);
    return updated;
  });

  ipcMain.handle('auth:spotify-logout', async () => {
    const updated = await logoutSpotify();
    mainWin?.webContents.send('settings:updated', updated);
    return updated;
  });

  ipcMain.handle('shell:open-folder', async (_e, targetPath?: string) => {
    const dir = targetPath || libraryStore.getSettings().downloadDir;
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
  });

  ipcMain.handle('shell:reveal-file', (_e, filePath: string) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });
}

downloadManager.subscribe((tasks, libraryChanged) => {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('downloads:updated', tasks);
    if (libraryChanged) {
      mainWin.webContents.send('library:updated', libraryStore.getSnapshot());
    }
  }
});

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (argv.includes('--quit')) {
      quitApplicationCompletely();
      return;
    }
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  });

  void app.whenReady().then(async () => {
    const isSmokeQuit = process.argv.includes('--smoke-test-quit');
    await mediaServer.start();
    if (!isSmokeQuit) {
      void resolveYtDlp().catch(() => {
        // Lazy retry when needed
      });
    }
    registerIpcHandlers();
    setupTrayAndShortcuts();
    createMainWindow(!isSmokeQuit);
    if (isSmokeQuit) {
      setTimeout(() => {
        quitApplicationCompletely();
      }, 450);
    }
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  downloadManager.shutdown();
  terminateAllBinaries();
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch {
    // Ignore
  }
  downloadManager.shutdown();
  terminateAllBinaries();
  mediaServer.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (isQuitting || !libraryStore.getSettings().minimizeToTray)) {
    quitApplicationCompletely();
  }
});
