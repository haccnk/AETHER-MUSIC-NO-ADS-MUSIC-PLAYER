import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { ChildProcess, spawn, execFileSync } from 'child_process';
import { getYouTubeYtDlpCookieArgs } from './authService';

export interface YtDlpCommand {
  command: string;
  baseArgs: string[];
}

let cachedYtDlp: YtDlpCommand | null = null;
let cachedFfmpegPath: string | null = null;
const activeChildren = new Set<ChildProcess>();

export function terminateAllBinaries(): void {
  for (const child of activeChildren) {
    try {
      child.kill();
    } catch {
      // Ignore already exited child
    }
  }
  activeChildren.clear();
}

export function getFfmpegPath(): string {
  if (cachedFfmpegPath && fs.existsSync(cachedFfmpegPath)) {
    return cachedFfmpegPath;
  }

  const packagedCandidates = [
    path.join(process.resourcesPath || '', 'bin', 'ffmpeg.exe'),
    path.join(app.getAppPath(), 'resources', 'bin', 'ffmpeg.exe'),
    path.join(process.cwd(), 'resources', 'bin', 'ffmpeg.exe'),
  ];
  for (const candidate of packagedCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      cachedFfmpegPath = candidate;
      return candidate;
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const staticPath = require('ffmpeg-static') as string | null;
    if (staticPath) {
      const unpacked = staticPath.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) {
        cachedFfmpegPath = unpacked;
        return unpacked;
      }
      if (fs.existsSync(staticPath)) {
        cachedFfmpegPath = staticPath;
        return staticPath;
      }
    }
  } catch {
    // Fallback to system ffmpeg
  }
  cachedFfmpegPath = 'ffmpeg';
  return 'ffmpeg';
}

function canExecute(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, { stdio: 'ignore', windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function resolveYtDlp(): Promise<YtDlpCommand> {
  if (cachedYtDlp) return cachedYtDlp;

  const candidates: YtDlpCommand[] = [
    { command: path.join(process.cwd(), 'resources', 'bin', 'yt-dlp.exe'), baseArgs: [] },
    { command: path.join(app.getAppPath(), 'resources', 'bin', 'yt-dlp.exe'), baseArgs: [] },
    { command: path.join(process.resourcesPath || '', 'bin', 'yt-dlp.exe'), baseArgs: [] },
    { command: path.join(app.getPath('appData'), 'aether-music', 'bin', 'yt-dlp.exe'), baseArgs: [] },
    { command: path.join(app.getPath('userData'), 'bin', 'yt-dlp.exe'), baseArgs: [] },
  ];

  for (const c of candidates) {
    if (fs.existsSync(c.command)) {
      cachedYtDlp = c;
      return c;
    }
  }

  if (canExecute('yt-dlp', ['--version'])) {
    cachedYtDlp = { command: 'yt-dlp', baseArgs: [] };
    return cachedYtDlp;
  }

  if (canExecute('python', ['-m', 'yt_dlp', '--version'])) {
    cachedYtDlp = { command: 'python', baseArgs: ['-m', 'yt_dlp'] };
    return cachedYtDlp;
  }

  // Auto-download standalone yt-dlp.exe into %APPDATA%\aether-music\bin if missing
  const userBinDir = path.join(app.getPath('appData'), 'aether-music', 'bin');
  fs.mkdirSync(userBinDir, { recursive: true });
  const targetExe = path.join(userBinDir, 'yt-dlp.exe');

  const res = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe');
  if (!res.ok) {
    throw new Error(`Cannot download yt-dlp.exe: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(targetExe, buffer);

  cachedYtDlp = { command: targetExe, baseArgs: [] };
  return cachedYtDlp;
}

export interface ExecOptions {
  onLine?: (line: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  allowCookieFallback?: boolean;
  skipCookies?: boolean;
}

const BROWSER_COOKIE_UNREADABLE_RE =
  /could not copy .* cookie database|database is locked|failed to decrypt with dpapi|app-bound|could not find .* cookies database|unsupported browser/i;

let browserCookieBlockedUntil = 0;

export function resetYtDlpCookieCooldown(): void {
  browserCookieBlockedUntil = 0;
}

function spawnYtDlp(
  runner: YtDlpCommand,
  fullArgs: string[],
  opts: ExecOptions
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(runner.command, fullArgs, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    activeChildren.add(child);

    let stdout = '';
    let stderr = '';
    let lineBuffer = '';
    let finished = false;

    const cleanup = () => {
      activeChildren.delete(child);
      if (timer) clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (!finished) {
        finished = true;
        child.kill('SIGTERM');
        cleanup();
        reject(new Error('ABORTED'));
      }
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        child.kill('SIGTERM');
        reject(new Error('ABORTED'));
        return;
      }
      opts.signal.addEventListener('abort', onAbort);
    }

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          if (!finished) {
            finished = true;
            child.kill('SIGTERM');
            cleanup();
            reject(new Error(`yt-dlp timed out after ${opts.timeoutMs}ms`));
          }
        }, opts.timeoutMs)
      : null;

    const processChunk = (text: string) => {
      if (!opts.onLine) return;
      lineBuffer += text.replace(/\r/g, '\n');
      const parts = lineBuffer.split('\n');
      lineBuffer = parts.pop() ?? '';
      for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed) opts.onLine(trimmed);
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      const str = chunk.toString('utf8');
      stdout += str;
      processChunk(str);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const str = chunk.toString('utf8');
      stderr += str;
      processChunk(str);
    });

    child.on('error', (err) => {
      if (!finished) {
        finished = true;
        cleanup();
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (lineBuffer.trim() && opts.onLine) {
        opts.onLine(lineBuffer.trim());
      }
      if (!finished) {
        finished = true;
        cleanup();
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        }
      }
    });
  });
}

export async function execYtDlp(args: string[], opts: ExecOptions = {}): Promise<string> {
  const runner = await resolveYtDlp();
  const hasExplicitCookie =
    args.includes('--cookies') || args.includes('--cookies-from-browser');
  const allowCookieFallback = opts.allowCookieFallback !== false;
  const rawCookieArgs =
    opts.skipCookies || hasExplicitCookie ? [] : getYouTubeYtDlpCookieArgs();

  const skipBrowserCookiesNow =
    allowCookieFallback &&
    rawCookieArgs[0] === '--cookies-from-browser' &&
    Date.now() < browserCookieBlockedUntil;

  const effectiveCookieArgs = skipBrowserCookiesNow ? [] : rawCookieArgs;
  const baseWithEncoding = [...runner.baseArgs, '--encoding', 'utf-8'];

  try {
    return await spawnYtDlp(runner, [...baseWithEncoding, ...effectiveCookieArgs, ...args], opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      allowCookieFallback &&
      !opts.signal?.aborted &&
      effectiveCookieArgs[0] === '--cookies-from-browser' &&
      BROWSER_COOKIE_UNREADABLE_RE.test(msg)
    ) {
      browserCookieBlockedUntil = Date.now() + 60_000;
      return spawnYtDlp(runner, [...baseWithEncoding, ...args], opts);
    }
    throw err;
  }
}
