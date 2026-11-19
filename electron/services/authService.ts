import { app, BrowserWindow, dialog, session, shell } from 'electron';
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AppSettings, YouTubeBrowserId, YouTubeVerifyResult } from '../../src/types/music';
import { libraryStore } from './store';

type ConcreteBrowserId = Exclude<YouTubeBrowserId, 'auto'>;

const CHROME_LOGIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const YT_LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&hl=vi&continue=https%3A%2F%2Fmusic.youtube.com%2F';

const SPOTIFY_PARTITION = 'persist:aether-spotify';

const BROWSER_LABELS: Record<ConcreteBrowserId, string> = {
  chrome: 'Google Chrome',
  edge: 'Microsoft Edge',
  firefox: 'Mozilla Firefox',
  brave: 'Brave',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
};

const BROWSER_EXE_NAMES: Record<ConcreteBrowserId, string> = {
  chrome: 'chrome.exe',
  edge: 'msedge.exe',
  firefox: 'firefox.exe',
  brave: 'brave.exe',
  opera: 'opera.exe',
  vivaldi: 'vivaldi.exe',
};

function getAuthDataDir(): string {
  const dir = path.join(app.getPath('appData'), 'aether-music');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getYtLoginCookiePath(): string {
  return path.join(getAuthDataDir(), 'youtube-login-cookies.txt');
}

function getYtCustomCookiePath(): string {
  return path.join(getAuthDataDir(), 'youtube-custom-cookies.txt');
}

function getSpotifySessionPath(): string {
  return path.join(getAuthDataDir(), 'spotify-session.json');
}

function mapProgIdToBrowser(progId: string): ConcreteBrowserId | null {
  const p = progId.toLowerCase();
  if (p.includes('chrome')) return 'chrome';
  if (p.includes('msedge') || p.includes('edge')) return 'edge';
  if (p.includes('firefox')) return 'firefox';
  if (p.includes('brave')) return 'brave';
  if (p.includes('opera')) return 'opera';
  if (p.includes('vivaldi')) return 'vivaldi';
  return null;
}

export function detectDefaultSystemBrowser(): {
  browser: ConcreteBrowserId | null;
  label: string;
} {
  if (process.platform !== 'win32') {
    return { browser: 'chrome', label: 'Google Chrome' };
  }

  try {
    const out = execFileSync(
      'reg.exe',
      [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice',
        '/v',
        'ProgId',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 3000 }
    );
    const match = /ProgId\s+REG_SZ\s+([^\r\n]+)/i.exec(out);
    const progId = match?.[1]?.trim() ?? '';
    const mapped = mapProgIdToBrowser(progId);
    if (mapped) {
      return { browser: mapped, label: BROWSER_LABELS[mapped] };
    }
    if (progId) {
      return { browser: null, label: progId };
    }
  } catch {
    // Ignore registry read errors
  }

  return { browser: null, label: 'Trình duyệt mặc định' };
}

function findBrowserExecutable(browser: ConcreteBrowserId): string | null {
  if (process.platform !== 'win32') return null;
  const exeName = BROWSER_EXE_NAMES[browser];

  const regRoots = [
    `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
    `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
  ];

  for (const regKey of regRoots) {
    try {
      const out = execFileSync('reg.exe', ['query', regKey, '/ve'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 2500,
      });
      const match = /REG_SZ\s+([^\r\n]+)/i.exec(out);
      const rawPath = match?.[1]?.trim().replace(/^"|"$/g, '');
      if (rawPath && fs.existsSync(rawPath)) {
        return rawPath;
      }
    } catch {
      // Try next root
    }
  }

  return null;
}

async function openUrlInBrowser(browser: YouTubeBrowserId, url: string): Promise<void> {
  if (browser !== 'auto') {
    const detected = detectDefaultSystemBrowser();
    if (detected.browser !== browser) {
      const exePath = findBrowserExecutable(browser);
      if (exePath) {
        try {
          const child = spawn(exePath, [url], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
          });
          child.unref();
          return;
        } catch {
          // Fall back to OS default browser
        }
      }
    }
  }

  await shell.openExternal(url);
}

export function getYouTubeYtDlpCookieArgs(): string[] {
  try {
    const settings = libraryStore.getSettings();
    if (!settings.youtubeConnected) return [];

    if (settings.youtubeAuthMode === 'cookie-file') {
      const customCopy = getYtCustomCookiePath();
      if (fs.existsSync(customCopy) && fs.statSync(customCopy).size > 32) {
        return ['--cookies', customCopy];
      }
      if (
        settings.youtubeCookieFile &&
        fs.existsSync(settings.youtubeCookieFile) &&
        fs.statSync(settings.youtubeCookieFile).size > 32
      ) {
        return ['--cookies', settings.youtubeCookieFile];
      }
      return [];
    }

    if (settings.youtubeAuthMode === 'browser-cookies') {
      const chosen = settings.youtubeBrowser || 'auto';
      const resolved =
        chosen === 'auto' ? detectDefaultSystemBrowser().browser : chosen;
      if (resolved) {
        return ['--cookies-from-browser', resolved];
      }
      return [];
    }

    if (settings.youtubeAuthMode === 'browser-login') {
      const loginFile = getYtLoginCookiePath();
      if (fs.existsSync(loginFile) && fs.statSync(loginFile).size > 32) {
        return ['--cookies', loginFile];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function loginYouTubeInBrowser(
  browser: YouTubeBrowserId = 'auto'
): Promise<AppSettings> {
  const { resetYtDlpCookieCooldown } = await import('./binaryManager');
  resetYtDlpCookieCooldown();
  await openUrlInBrowser(browser, YT_LOGIN_URL);

  const detected = detectDefaultSystemBrowser();
  const resolvedBrowser =
    browser === 'auto' ? detected.browser : browser;
  const label = resolvedBrowser
    ? `${BROWSER_LABELS[resolvedBrowser]} (${browser === 'auto' ? 'Mặc định' : 'Đã chọn'})`
    : detected.label;

  return libraryStore.updateSettings({
    youtubeConnected: true,
    youtubeAuthMode: 'browser-cookies',
    youtubeBrowser: browser,
    youtubeCookieFile: label,
  });
}

export async function verifyYouTubeAuth(): Promise<YouTubeVerifyResult> {
  const settings = libraryStore.getSettings();
  const isVi = settings.language !== 'en';
  const cookieArgs = getYouTubeYtDlpCookieArgs();

  if (cookieArgs.length === 0) {
    return {
      ok: false,
      errorCode: 'not-signed-in',
      message: isVi
        ? 'Chưa chọn trình duyệt hoặc file cookies.txt để xác thực.'
        : 'No browser or cookies.txt authentication configured yet.',
    };
  }

  const browserLabel =
    cookieArgs[0] === '--cookies-from-browser' ? cookieArgs[1] : 'cookies.txt';

  try {
    const { execYtDlp, resetYtDlpCookieCooldown } = await import('./binaryManager');
    resetYtDlpCookieCooldown();
    await execYtDlp(
      [
        'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        '--skip-download',
        '--no-playlist',
        '--no-warnings',
        '-j',
      ],
      { timeoutMs: 18000, allowCookieFallback: false }
    );

    return {
      ok: true,
      browser: browserLabel,
      message: isVi
        ? `Kết nối thành công! yt-dlp đã đọc được phiên xác thực từ ${browserLabel}.`
        : `Connected! yt-dlp can read your authentication session from ${browserLabel}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (/could not copy .* cookie database|database is locked/i.test(msg)) {
      return {
        ok: false,
        browser: browserLabel,
        errorCode: 'cookie-locked',
        message: isVi
          ? `${browserLabel} đang chạy và khóa file cookie trên Windows. Hãy đóng hẳn ${browserLabel} khi tải hoặc dùng nút "Chọn file cookies.txt" / trình duyệt Firefox.`
          : `${browserLabel} is currently running and locking its cookie database on Windows. Close ${browserLabel} while downloading, switch to Firefox, or import cookies.txt.`,
      };
    }

    if (/failed to decrypt with dpapi|app-bound/i.test(msg)) {
      return {
        ok: false,
        browser: browserLabel,
        errorCode: 'dpapi-encrypted',
        message: isVi
          ? `${browserLabel} bản mới trên Windows mã hóa cookie (App-Bound Encryption) nên yt-dlp không đọc trực tiếp được. Hãy dùng Firefox hoặc xuất file cookies.txt nạp vào đây.`
          : `Recent ${browserLabel} versions on Windows use App-Bound Encryption so yt-dlp cannot read cookies directly. Use Firefox or import cookies.txt.`,
      };
    }

    if (/could not find .* cookies database|unsupported browser/i.test(msg)) {
      return {
        ok: false,
        browser: browserLabel,
        errorCode: 'missing-browser',
        message: isVi
          ? `Không tìm thấy hồ sơ dữ liệu của trình duyệt ${browserLabel} trên máy.`
          : `Could not locate cookie profile for browser ${browserLabel}.`,
      };
    }

    if (/sign in to confirm|not a bot|cookies are no longer valid/i.test(msg)) {
      return {
        ok: false,
        browser: browserLabel,
        errorCode: 'not-signed-in',
        message: isVi
          ? `Trình duyệt ${browserLabel} chưa đăng nhập YouTube hoặc phiên đã hết hạn. Hãy bấm "Mở trình duyệt đăng nhập" để đăng nhập lại.`
          : `${browserLabel} is not signed in to YouTube yet or its session expired. Click "Open browser to sign in" again.`,
      };
    }

    return {
      ok: false,
      browser: browserLabel,
      errorCode: 'unknown',
      message: msg,
    };
  }
}

export async function pickYouTubeCookieFile(
  parentWin: BrowserWindow | null
): Promise<AppSettings> {
  if (!parentWin) return libraryStore.getSettings();
  const res = await dialog.showOpenDialog(parentWin, {
    title: 'Chọn file cookies.txt (Netscape format)',
    properties: ['openFile'],
    filters: [
      { name: 'Netscape Cookies (cookies.txt)', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (res.canceled || res.filePaths.length === 0) {
    return libraryStore.getSettings();
  }

  const chosen = res.filePaths[0];
  try {
    const content = fs.readFileSync(chosen, 'utf8');
    if (content.trim().length < 20) {
      return libraryStore.getSettings();
    }
    fs.writeFileSync(getYtCustomCookiePath(), content, 'utf8');
    const { resetYtDlpCookieCooldown } = await import('./binaryManager');
    resetYtDlpCookieCooldown();
    return libraryStore.updateSettings({
      youtubeConnected: true,
      youtubeAuthMode: 'cookie-file',
      youtubeCookieFile: chosen,
    });
  } catch {
    return libraryStore.getSettings();
  }
}

export async function logoutYouTube(): Promise<AppSettings> {
  const { resetYtDlpCookieCooldown } = await import('./binaryManager');
  resetYtDlpCookieCooldown();
  try {
    if (fs.existsSync(getYtLoginCookiePath())) {
      fs.writeFileSync(getYtLoginCookiePath(), '', 'utf8');
    }
    if (fs.existsSync(getYtCustomCookiePath())) {
      fs.writeFileSync(getYtCustomCookiePath(), '', 'utf8');
    }
  } catch {
    // Ignore file write errors
  }

  return libraryStore.updateSettings({
    youtubeConnected: false,
    youtubeAuthMode: 'none',
    youtubeCookieFile: '',
  });
}

export function getSpotifyCookieHeader(): string | null {
  try {
    const settings = libraryStore.getSettings();
    if (!settings.spotifyConnected) return null;
    const sessionPath = getSpotifySessionPath();
    if (!fs.existsSync(sessionPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as {
      cookieHeader?: string;
    };
    return parsed.cookieHeader && parsed.cookieHeader.length > 10
      ? parsed.cookieHeader
      : null;
  } catch {
    return null;
  }
}

async function exportSpotifySessionCookies(): Promise<boolean> {
  try {
    const ses = session.fromPartition(SPOTIFY_PARTITION);
    await ses.cookies.flushStore();
    const cookies = await ses.cookies.get({});
    const spCookies = cookies.filter(
      (c) => c.domain && c.domain.includes('spotify.com') && Boolean(c.value)
    );
    const hasSpDc = spCookies.some((c) => c.name === 'sp_dc');
    if (!hasSpDc) return false;

    const cookieHeader = spCookies.map((c) => `${c.name}=${c.value}`).join('; ');
    fs.writeFileSync(
      getSpotifySessionPath(),
      JSON.stringify({ cookieHeader, updatedAt: Date.now() }, null, 2),
      'utf8'
    );
    return true;
  } catch {
    return false;
  }
}

export async function loginSpotifyWindow(
  parentWin: BrowserWindow | null
): Promise<AppSettings> {
  const ses = session.fromPartition(SPOTIFY_PARTITION);
  ses.setUserAgent(CHROME_LOGIN_UA);

  return new Promise<AppSettings>((resolve) => {
    let settled = false;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;

    const authWin = new BrowserWindow({
      width: 520,
      height: 700,
      parent: parentWin ?? undefined,
      modal: false,
      show: true,
      autoHideMenuBar: true,
      title: 'Đăng nhập Spotify',
      backgroundColor: '#0B0D14',
      webPreferences: {
        partition: SPOTIFY_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    authWin.webContents.setUserAgent(CHROME_LOGIN_UA);

    const finish = async (fromRedirect = false) => {
      if (settled) return;
      const exported = await exportSpotifySessionCookies();
      if (exported) {
        settled = true;
        if (checkTimer) clearTimeout(checkTimer);
        const updated = libraryStore.updateSettings({
          spotifyConnected: true,
        });
        if (!authWin.isDestroyed()) {
          authWin.close();
        }
        resolve(updated);
      } else if (!fromRedirect && authWin.isDestroyed()) {
        settled = true;
        if (checkTimer) clearTimeout(checkTimer);
        resolve(libraryStore.getSettings());
      }
    };

    const scheduleCheck = (url: string) => {
      if (settled) return;
      if (/^https:\/\/open\.spotify\.com/i.test(url)) {
        if (checkTimer) clearTimeout(checkTimer);
        checkTimer = setTimeout(() => {
          void finish(true);
        }, 700);
      }
    };

    authWin.webContents.on('did-navigate', (_e, url) => scheduleCheck(url));
    authWin.webContents.on('did-navigate-in-page', (_e, url) => scheduleCheck(url));
    authWin.webContents.on('did-finish-load', () => {
      if (!authWin.isDestroyed()) {
        scheduleCheck(authWin.webContents.getURL());
      }
    });

    authWin.on('closed', () => {
      if (checkTimer) clearTimeout(checkTimer);
      void finish(false);
    });

    void authWin.loadURL(
      'https://accounts.spotify.com/vi/login?continue=https%3A%2F%2Fopen.spotify.com%2F'
    );
  });
}

export async function logoutSpotify(): Promise<AppSettings> {
  try {
    const ses = session.fromPartition(SPOTIFY_PARTITION);
    await ses.clearStorageData();
  } catch {
    // Ignore storage clear errors
  }

  try {
    if (fs.existsSync(getSpotifySessionPath())) {
      fs.writeFileSync(getSpotifySessionPath(), '{}', 'utf8');
    }
  } catch {
    // Ignore file write errors
  }

  return libraryStore.updateSettings({
    spotifyConnected: false,
  });
}
