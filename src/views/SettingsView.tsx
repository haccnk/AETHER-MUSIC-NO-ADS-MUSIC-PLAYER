import React, { useEffect, useState } from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  FileText,
  FolderOpen,
  FolderPlus,
  Globe,
  LockOpen,
  PlugsConnected,
  SignIn,
  SignOut,
  SpinnerGap,
  SpotifyLogo,
  Trash,
  WarningCircle,
  YoutubeLogo,
} from '@phosphor-icons/react';
import { usePlayerStore } from '../store/usePlayerStore';
import { YouTubeBrowserId, YouTubeVerifyResult } from '../types/music';
import { cn } from '../utils/format';

const YT_BROWSER_CHOICES: Array<{ id: YouTubeBrowserId; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'edge', label: 'Edge' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'brave', label: 'Brave' },
  { id: 'opera', label: 'Opera' },
];

export const SettingsView: React.FC = () => {
  const settings = usePlayerStore((s) => s.settings);
  const updateSettings = usePlayerStore((s) => s.updateSettings);
  const pickDownloadDir = usePlayerStore((s) => s.pickDownloadDir);
  const addLocalFolder = usePlayerStore((s) => s.addLocalFolder);
  const removeLocalFolder = usePlayerStore((s) => s.removeLocalFolder);
  const t = usePlayerStore((s) => s.t());

  const [ytBusy, setYtBusy] = useState(false);
  const [ytVerifying, setYtVerifying] = useState(false);
  const [ytVerifyResult, setYtVerifyResult] = useState<YouTubeVerifyResult | null>(null);
  const [defaultBrowserLabel, setDefaultBrowserLabel] = useState<string>('Chrome');
  const [spBusy, setSpBusy] = useState(false);

  const selectedBrowser: YouTubeBrowserId = settings.youtubeBrowser || 'auto';

  useEffect(() => {
    void window.aetherAPI?.detectDefaultBrowser?.().then((res) => {
      if (res?.label) setDefaultBrowserLabel(res.label);
    });
  }, []);

  const handleSelectBrowser = async (browser: YouTubeBrowserId) => {
    setYtVerifyResult(null);
    await updateSettings({ youtubeBrowser: browser });
  };

  const handleYouTubeLogin = async () => {
    setYtBusy(true);
    setYtVerifyResult(null);
    try {
      const updated = await window.aetherAPI.loginYouTube(selectedBrowser);
      usePlayerStore.setState({ settings: updated });
    } finally {
      setYtBusy(false);
    }
  };

  const handleVerifyYouTube = async () => {
    setYtVerifying(true);
    try {
      const res = await window.aetherAPI.verifyYouTubeAuth();
      setYtVerifyResult(res);
    } finally {
      setYtVerifying(false);
    }
  };

  const handlePickYouTubeCookies = async () => {
    setYtBusy(true);
    setYtVerifyResult(null);
    try {
      const updated = await window.aetherAPI.pickYouTubeCookieFile();
      usePlayerStore.setState({ settings: updated });
    } finally {
      setYtBusy(false);
    }
  };

  const handleYouTubeLogout = async () => {
    setYtBusy(true);
    setYtVerifyResult(null);
    try {
      const updated = await window.aetherAPI.logoutYouTube();
      usePlayerStore.setState({ settings: updated });
    } finally {
      setYtBusy(false);
    }
  };

  const handleSpotifyLogin = async () => {
    setSpBusy(true);
    try {
      const updated = await window.aetherAPI.loginSpotify();
      usePlayerStore.setState({ settings: updated });
    } finally {
      setSpBusy(false);
    }
  };

  const handleSpotifyLogout = async () => {
    setSpBusy(true);
    try {
      const updated = await window.aetherAPI.logoutSpotify();
      usePlayerStore.setState({ settings: updated });
    } finally {
      setSpBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-36">
      <h1 className="text-[28px] font-extrabold tracking-tight text-white">
        {t.settings.title}
      </h1>

      {/* Connected Accounts: YouTube & Spotify */}
      <div className="bezel-outer">
        <div className="bezel-inner space-y-5 p-6">
          <h2 className="text-[15.5px] font-bold tracking-tight text-white">
            {t.settings.accountsHeading}
          </h2>

          {/* YouTube / YouTube Music Auth */}
          <div className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
                <YoutubeLogo size={22} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold text-white">
                    {t.settings.youtubeAccountTitle}
                  </p>
                  {settings.youtubeConnected ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                      <CheckCircle size={12} weight="fill" />
                      {t.settings.youtubeConnectedBadge}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-white/55">
                      {t.settings.youtubeDisconnectedBadge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
                  {t.settings.youtubeAccountDesc}
                </p>
                {settings.youtubeConnected && settings.youtubeCookieFile && (
                  <p className="mt-1.5 truncate font-mono text-[11.5px] text-cyan-200/85">
                    {settings.youtubeCookieFile}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={ytBusy}
                onClick={() => void handleYouTubeLogin()}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-[12.5px] font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {ytBusy ? (
                  <SpinnerGap size={14} className="animate-spin" />
                ) : (
                  <ArrowSquareOut size={14} weight="bold" />
                )}
                {t.settings.youtubeLoginBtn}
              </button>

              {settings.youtubeConnected && (
                <button
                  type="button"
                  disabled={ytBusy || ytVerifying}
                  onClick={() => void handleVerifyYouTube()}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-cyan-400/35 bg-cyan-400/15 px-3.5 py-1.5 text-[12.5px] font-semibold text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-50"
                >
                  {ytVerifying ? (
                    <SpinnerGap size={14} className="animate-spin" />
                  ) : (
                    <PlugsConnected size={14} weight="bold" />
                  )}
                  {t.settings.youtubeVerifyBtn}
                </button>
              )}

              <button
                type="button"
                disabled={ytBusy}
                onClick={() => void handlePickYouTubeCookies()}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[12.5px] font-semibold text-white/90 hover:bg-white/12 disabled:opacity-50"
              >
                <FileText size={14} />
                {t.settings.youtubeCookieBtn}
              </button>

              {settings.youtubeConnected && (
                <button
                  type="button"
                  disabled={ytBusy}
                  onClick={() => void handleYouTubeLogout()}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-400/30 bg-rose-500/15 px-3.5 py-1.5 text-[12.5px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                >
                  <SignOut size={14} />
                  {t.settings.logoutBtn}
                </button>
              )}
            </div>

            {/* Browser Selector for Redirect + --cookies-from-browser */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <span className="text-[12px] text-white/55">{t.settings.youtubeBrowserLabel}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {YT_BROWSER_CHOICES.map((b) => {
                  const isActive = selectedBrowser === b.id;
                  const label =
                    b.id === 'auto'
                      ? t.settings.youtubeBrowserAuto.replace('{name}', defaultBrowserLabel)
                      : b.label;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => void handleSelectBrowser(b.id)}
                      className={cn(
                        'whitespace-nowrap rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
                        isActive
                          ? 'border-white bg-white text-black'
                          : 'border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {ytVerifyResult && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12px] leading-relaxed',
                  ytVerifyResult.ok
                    ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                    : 'border-amber-400/35 bg-amber-400/10 text-amber-200'
                )}
              >
                {ytVerifyResult.ok ? (
                  <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-emerald-300" />
                ) : (
                  <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-amber-300" />
                )}
                <span>{ytVerifyResult.message}</span>
              </div>
            )}
          </div>

          {/* Spotify Auth */}
          <div className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
                <SpotifyLogo size={22} weight="fill" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold text-white">
                    {t.settings.spotifyAccountTitle}
                  </p>
                  {settings.spotifyConnected ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                      <CheckCircle size={12} weight="fill" />
                      {t.settings.spotifyConnectedBadge}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-white/55">
                      {t.settings.spotifyDisconnectedBadge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
                  {t.settings.spotifyAccountDesc}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={spBusy}
                onClick={() => void handleSpotifyLogin()}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-400/35 bg-emerald-500/15 px-4 py-1.5 text-[12.5px] font-bold text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {spBusy ? (
                  <SpinnerGap size={14} className="animate-spin" />
                ) : (
                  <SignIn size={14} weight="bold" />
                )}
                {t.settings.spotifyLoginBtn}
              </button>

              {settings.spotifyConnected && (
                <button
                  type="button"
                  disabled={spBusy}
                  onClick={() => void handleSpotifyLogout()}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-400/30 bg-rose-500/15 px-3.5 py-1.5 text-[12.5px] font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                >
                  <SignOut size={14} />
                  {t.settings.logoutBtn}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Language & Audio */}
      <div className="bezel-outer">
        <div className="bezel-inner space-y-5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Globe size={20} className="text-cyan-300" />
              <span className="text-[14.5px] font-semibold text-white">
                {t.settings.language}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] p-1">
              {(['vi', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => void updateSettings({ language: lang })}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all',
                    settings.language === lang
                      ? 'bg-white text-black'
                      : 'text-white/65 hover:text-white'
                  )}
                >
                  {lang === 'vi' ? 'Tiếng Việt' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/[0.07]" />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14.5px] font-semibold text-white">{t.settings.crossfade}</p>
              <p className="font-mono text-[12px] text-cyan-300">
                {settings.crossfadeSeconds === 0
                  ? t.eq.crossfadeOff
                  : t.eq.crossfadeSec.replace('{s}', String(settings.crossfadeSeconds))}
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={settings.crossfadeSeconds}
              onChange={(e) =>
                void updateSettings({ crossfadeSeconds: parseInt(e.target.value, 10) })
              }
              style={
                {
                  '--range-pct': `${Math.round((settings.crossfadeSeconds / 12) * 100)}%`,
                } as React.CSSProperties
              }
              className="aether-range w-48 shrink-0"
            />
          </div>

          <div className="h-px bg-white/[0.07]" />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14.5px] font-semibold text-white">{t.settings.concurrent}</p>
              <p className="font-mono text-[12px] text-white/55">
                {settings.maxConcurrentDownloads} threads
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => void updateSettings({ maxConcurrentDownloads: n })}
                  className={cn(
                    'h-8 w-8 rounded-xl font-mono text-[12.5px] font-bold transition-all',
                    settings.maxConcurrentDownloads === n
                      ? 'bg-white text-black'
                      : 'border border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/10'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/[0.07]" />

          <div className="flex items-center justify-between gap-4">
            <span className="text-[14px] font-medium text-white/90">
              {t.settings.minimizeToTray}
            </span>
            <button
              type="button"
              onClick={() =>
                void updateSettings({ minimizeToTray: !settings.minimizeToTray })
              }
              className={cn(
                'rounded-full border px-4 py-1.5 text-[12px] font-bold transition-colors',
                settings.minimizeToTray
                  ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                  : 'border-white/15 bg-white/5 text-white/55'
              )}
            >
              {settings.minimizeToTray ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="h-px bg-white/[0.07]" />

          <div className="flex items-center justify-between gap-4">
            <span className="text-[14px] font-medium text-white/90">
              {t.settings.desktopLyricsLock}
            </span>
            {settings.desktopLyricsLocked ? (
              <button
                type="button"
                onClick={() => void window.aetherAPI?.setDesktopLyricsLock(false)}
                className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3.5 py-1.5 text-[12px] font-semibold text-amber-200"
              >
                <LockOpen size={14} />
                {t.settings.unlockNow}
              </button>
            ) : (
              <span className="text-[12.5px] text-white/50">{t.settings.unlockedState}</span>
            )}
          </div>
        </div>
      </div>

      {/* Download Destination Folder */}
      <div className="bezel-outer">
        <div className="bezel-inner space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold text-white">{t.settings.downloadDir}</p>
              <p className="mt-1 truncate font-mono text-[12.5px] text-cyan-200/85">
                {settings.downloadDir}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void window.aetherAPI?.openFolder(settings.downloadDir)}
                className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 text-[12.5px] font-medium text-white/85 hover:bg-white/12"
              >
                <FolderOpen size={14} />
                {t.settings.openDir}
              </button>
              <button
                type="button"
                onClick={() => void pickDownloadDir()}
                className="rounded-full bg-white px-4 py-1.5 text-[12.5px] font-bold text-black"
              >
                {t.settings.changeDir}
              </button>
            </div>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Local Scanned Folders */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[14.5px] font-semibold text-white">{t.settings.localFolders}</p>
              <button
                type="button"
                onClick={() => void addLocalFolder()}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/15"
              >
                <FolderPlus size={14} />
                {t.settings.addLocalFolder}
              </button>
            </div>

            {settings.localFolders.length > 0 && (
              <div className="mt-3 space-y-2">
                {settings.localFolders.map((folder) => (
                  <div
                    key={folder}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2"
                  >
                    <span className="truncate font-mono text-[12px] text-white/75">
                      {folder}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeLocalFolder(folder)}
                      className="text-white/45 hover:text-rose-300"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
