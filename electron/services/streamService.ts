import fs from 'fs';
import { StreamResolution, Track } from '../../src/types/music';
import { getYouTubeYtDlpCookieArgs } from './authService';
import { execYtDlp } from './binaryManager';
import { mediaServer } from './mediaServer';
import { libraryStore } from './store';

interface CachedYoutubeMatch {
  youtubeId: string;
  matchedDuration?: number;
}

interface CachedStreamInfo {
  streamUrl: string;
  headers: Record<string, string>;
  youtubeId: string;
  actualDuration?: number;
  expiresAt: number;
}

interface YtSearchCandidate {
  id?: string;
  title?: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  live_status?: string;
}

const youtubeMatchCache = new Map<string, CachedYoutubeMatch>();
const streamInfoCache = new Map<string, CachedStreamInfo>();
const inFlightResolutions = new Map<string, Promise<StreamResolution>>();

export function cleanSearchTerm(s: string): string {
  return s
    .replace(/\(feat\..*?\)|\[feat\..*?\]|\(ft\..*?\)/gi, '')
    .replace(/-\s*Single$/i, '')
    .trim();
}

export function normalizeCmp(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function hasCjk(s: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u.test(s);
}

export function hasJapanese(s: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u.test(s);
}

const DUAL_SCRIPT_ALIASES: Array<[string, string]> = [
  ['初音ミク', 'hatsunemiku'],
  ['重音テト', 'kasaneteto'],
  ['鏡音リン', 'kagaminerin'],
  ['鏡音レン', 'kagaminelen'],
  ['巡音ルカ', 'megurineluka'],
  ['可不', 'kafu'],
];

export function extractArtistTokens(track: Track): string[] {
  const sources = [track.artist];
  const featMatch = /\((?:feat|ft)\.?\s+([^)]+)\)/gi.exec(track.title);
  if (featMatch?.[1]) sources.push(featMatch[1]);

  const rawTokens = sources
    .join(',')
    .split(/[,&×/]|(?:\b(?:feat|ft|cv)\.?\b)|[()[\]]/i)
    .map((part) => normalizeCmp(part))
    .filter((tok) => tok.length >= 2);

  const out = new Set<string>(rawTokens);
  for (const [jp, romaji] of DUAL_SCRIPT_ALIASES) {
    const jpNorm = normalizeCmp(jp);
    if (out.has(jpNorm)) out.add(romaji);
    if (out.has(romaji)) out.add(jpNorm);
  }
  return [...out];
}

export function parseClockDuration(text: string): number {
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (!m) return 0;
  if (m[3]) {
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

function parsePlayCountScore(text: string): number {
  const m = /(\d+(?:\.\d+)?)\s*([KMB万億])/i.exec(text);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  const count =
    unit === 'B'
      ? val * 1e9
      : unit === 'M'
        ? val * 1e6
        : unit === 'K'
          ? val * 1e3
          : unit === '億'
            ? val * 1e8
            : val * 1e4;
  if (count >= 50_000_000) return 24;
  if (count >= 5_000_000) return 18;
  if (count >= 500_000) return 12;
  if (count >= 50_000) return 6;
  return 0;
}

const UNSOLICITED_SONG_VARIANTS = [
  'english ver',
  'english version',
  'english cover',
  'english 60',
  'eng ver',
  'en ver',
  'japanese ver',
  'korean ver',
  'chinese ver',
  'spanish ver',
  'dubbed',
  'auto-dubbed',
  'cover',
  'remix',
  'karaoke',
  'カラオケ',
  'instrumental',
  'off vocal',
  'inst.',
  'slowed',
  'sped up',
  'nightcore',
  'hardstyle',
  'lofi',
  '8d',
  'live',
  "60's",
  'acoustic',
  'piano ver',
  'utau',
  'key+',
  'key-',
];

export function hasTokenMatch(tokens: string[], normHaystack: string): boolean {
  if (!normHaystack) return false;
  return tokens.some(
    (tok) =>
      tok.length >= 2 &&
      (normHaystack === tok || normHaystack.includes(tok) || (normHaystack.length >= 3 && tok.includes(normHaystack)))
  );
}

async function searchYouTubeMusicOfficialSong(track: Track): Promise<CachedYoutubeMatch | null> {
  const primaryArtist = track.artist.split(',')[0].split('&')[0].trim();
  const cleanTitle = cleanSearchTerm(track.title);
  const query = `${primaryArtist} ${cleanTitle}`.trim();
  const isJp = hasJapanese(`${track.title} ${track.artist}`);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241118.01.00',
            hl: isJp ? 'ja' : 'en',
            gl: isJp ? 'JP' : 'VN',
          },
        },
        query,
        params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D', // Songs filter -> Official Art Tracks
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      contents?: {
        tabbedSearchResultsRenderer?: {
          tabs?: Array<{
            tabRenderer?: {
              content?: {
                sectionListRenderer?: {
                  contents?: Array<{
                    musicShelfRenderer?: {
                      contents?: Array<{
                        musicResponsiveListItemRenderer?: {
                          playlistItemData?: { videoId?: string };
                          flexColumns?: Array<{
                            musicResponsiveListItemFlexColumnRenderer?: {
                              text?: { runs?: Array<{ text?: string }> };
                            };
                          }>;
                        };
                      }>;
                    };
                  }>;
                };
              };
            };
          }>;
        };
      };
    };

    const shelves =
      json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.sectionListRenderer?.contents ?? [];

    const wantTitle = normalizeCmp(cleanTitle);
    const wantPrimaryArtist = normalizeCmp(primaryArtist);
    const artistTokens = extractArtistTokens(track);
    const trackLower = track.title.toLowerCase();

    let bestScore = -9999;
    let bestMatch: CachedYoutubeMatch | null = null;

    for (const shelf of shelves) {
      const items = shelf?.musicShelfRenderer?.contents ?? [];
      for (let idx = 0; idx < Math.min(items.length, 6); idx++) {
        const renderer = items[idx]?.musicResponsiveListItemRenderer;
        const vid = renderer?.playlistItemData?.videoId;
        if (!vid) continue;

        const cols = (renderer.flexColumns ?? []).map((fc) =>
          (fc?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [])
            .map((r) => r.text ?? '')
            .join('')
        );
        const itemTitle = cols[0] ?? '';
        const metaLine = cols[1] ?? '';
        const playLine = cols[2] ?? '';
        const metaParts = metaLine.split('•').map((p) => p.trim());
        const itemArtistRaw = metaParts[0] ?? metaLine;
        const itemDur = parseClockDuration(metaLine);
        const itemTitleLower = itemTitle.toLowerCase();
        const itemMetaLower = metaLine.toLowerCase();
        const normTitle = normalizeCmp(cleanSearchTerm(itemTitle));
        const normItemArtist = normalizeCmp(itemArtistRaw);
        const normMeta = normalizeCmp(metaLine);

        let score = 40 - idx * 6; // Prefer top official YTM ranking slightly
        score += parsePlayCountScore(`${metaLine} ${playLine}`);

        // Strict artist verification (prevents wrong-artist homonyms like English covers)
        const primaryMatched =
          wantPrimaryArtist.length >= 2 &&
          (normItemArtist === wantPrimaryArtist ||
            normItemArtist.includes(wantPrimaryArtist) ||
            (normItemArtist.length >= 2 && wantPrimaryArtist.includes(normItemArtist)));
        const anyArtistMatched =
          primaryMatched ||
          hasTokenMatch(artistTokens, normItemArtist) ||
          hasTokenMatch(artistTokens, normTitle) ||
          hasTokenMatch(artistTokens, normMeta);

        if (primaryMatched) {
          score += 105;
        } else if (anyArtistMatched) {
          score += 85;
        } else {
          score -= 165;
        }

        // Title match (Unicode-aware + controlled cross-script YTM official alias support)
        if (wantTitle.length > 0 && normTitle.length > 0) {
          if (normTitle === wantTitle) {
            score += 95;
          } else if (
            wantTitle.length >= 2 &&
            normTitle.length >= 2 &&
            (normTitle.includes(wantTitle) || wantTitle.includes(normTitle))
          ) {
            score += 50;
          } else if (
            anyArtistMatched &&
            idx <= 2 &&
            hasCjk(itemTitle) !== hasCjk(cleanTitle)
          ) {
            score += 55;
          } else {
            score -= 55;
          }
        } else {
          score -= 55;
        }

        if (track.duration > 20 && itemDur > 0) {
          const diff = Math.abs(itemDur - track.duration);
          if (diff <= 3) score += 150;
          else if (diff <= 6) score += 100;
          else if (diff <= 12) score += 40;
          else if (diff > 20) score -= 120;
        }

        for (const kw of UNSOLICITED_SONG_VARIANTS) {
          if (
            (itemTitleLower.includes(kw) || itemMetaLower.includes(kw)) &&
            !trackLower.includes(kw)
          ) {
            score -= 150;
          }
        }
        if (!trackLower.includes('english') && /\benglish\b/i.test(itemTitle)) {
          score -= 150;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            youtubeId: vid,
            matchedDuration: itemDur > 0 ? itemDur : undefined,
          };
        }
      }
    }

    if (bestMatch && bestScore >= 90) {
      return bestMatch;
    }
    return null;
  } catch {
    return null;
  }
}

function scoreCandidate(cand: YtSearchCandidate, track: Track): number {
  if (!cand.id) return -9999;
  if (cand.live_status === 'is_live') return -9999;

  const candDur = cand.duration ?? 0;
  if (track.duration > 0 && track.duration < 600 && candDur > 1200) {
    return -9999;
  }

  let score = 0;
  const titleLower = (cand.title || '').toLowerCase();
  const trackLower = track.title.toLowerCase();
  const channelLower = (cand.channel || cand.uploader || '').toLowerCase();
  const normCandTitle = normalizeCmp(cand.title || '');
  const normChannel = normalizeCmp(cand.channel || cand.uploader || '');
  const artistTokens = extractArtistTokens(track);

  if (track.duration > 20 && candDur > 0) {
    const diff = Math.abs(candDur - track.duration);
    if (diff <= 2) score += 140;
    else if (diff <= 4) score += 110;
    else if (diff <= 8) score += 65;
    else if (diff <= 14) score += 20;
    else if (diff > 20) score -= 110;
  }

  if ((cand.channel || '').endsWith('- Topic') || (cand.uploader || '').endsWith('- Topic')) {
    score += 75;
  }
  if (titleLower.includes('official audio') || titleLower.includes('audio')) {
    score += 22;
  }
  if (titleLower.includes('lyrics')) {
    score += 12;
  }

  if (hasTokenMatch(artistTokens, normChannel) || hasTokenMatch(artistTokens, normCandTitle)) {
    score += 65;
  } else {
    score -= 140;
  }

  const badVariants = [
    'official music video',
    'music video',
    'official mv',
    'm/v',
    'teaser',
    'trailer',
    'reaction',
    'karaoke',
    'カラオケ',
    'instrumental',
    'off vocal',
    '1 hour',
    'slowed',
    'sped up',
    'nightcore',
    'hardstyle',
    '8d',
    'softer version',
    'english ver',
    'english version',
    'eng ver',
    'dubbed',
  ];
  for (const kw of badVariants) {
    if (titleLower.includes(kw) && !trackLower.includes(kw)) {
      score -= 130;
    }
  }
  if (!trackLower.includes('english') && /\benglish\b/i.test(titleLower)) {
    score -= 150;
  }

  const conditionalVariants = ['live', 'cover', 'remix', 'acoustic', 'piano'];
  for (const kw of conditionalVariants) {
    if ((titleLower.includes(kw) || channelLower.includes(kw)) && !trackLower.includes(kw)) {
      score -= 95;
    }
  }

  return score;
}

export async function resolveBestYoutubeAudio(track: Track): Promise<CachedYoutubeMatch> {
  if (track.youtubeId) {
    return {
      youtubeId: track.youtubeId,
      matchedDuration: track.duration > 0 ? track.duration : undefined,
    };
  }

  const cached = youtubeMatchCache.get(track.id);
  if (cached) return cached;

  // 1. Primary: Query YouTube Music WEB_REMIX Songs filter -> gets exact ISRC label studio audio
  const ytmSong = await searchYouTubeMusicOfficialSong(track);
  if (ytmSong) {
    youtubeMatchCache.set(track.id, ytmSong);
    return ytmSong;
  }

  // 2. Fallback: yt-dlp duration-scored search
  const primaryArtist = track.artist.split(',')[0].split('&')[0].trim();
  const cleanTitle = cleanSearchTerm(track.title);
  const query = `${primaryArtist} ${cleanTitle} audio`;

  const stdout = await execYtDlp(
    [`ytsearch8:${query}`, '--flat-playlist', '--dump-json', '--no-warnings'],
    { timeoutMs: 22000 }
  );

  const candidates: YtSearchCandidate[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as YtSearchCandidate;
      if (parsed.id) candidates.push(parsed);
    } catch {
      // Ignore malformed line
    }
  }

  if (candidates.length === 0) {
    throw new Error(`Could not find audio source for "${track.title}"`);
  }

  candidates.sort((a, b) => scoreCandidate(b, track) - scoreCandidate(a, track));
  const best = candidates[0];
  if (!best?.id) {
    throw new Error(`Could not find audio source for "${track.title}"`);
  }

  const result: CachedYoutubeMatch = {
    youtubeId: best.id,
    matchedDuration: best.duration ? Math.round(best.duration) : undefined,
  };
  youtubeMatchCache.set(track.id, result);
  return result;
}

const STREAM_FORMAT_SELECTOR =
  'bestaudio[protocol=https][format_note*=original][ext=m4a]/bestaudio[protocol=https][format_note*=original][ext=webm]/bestaudio[protocol=https][format_note!*=dubbed][ext=m4a]/bestaudio[protocol=https][format_note!*=dubbed][ext=webm]/bestaudio[protocol=https]';

interface YtStreamInfoJson {
  url?: string;
  duration?: number;
  protocol?: string;
  http_headers?: Record<string, string>;
}

async function probeDirectStreamPlayable(
  url: string,
  headers: Record<string, string>
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        ...headers,
        Range: 'bytes=0-1',
      },
    });
    clearTimeout(timer);
    res.body?.cancel?.().catch(() => {});
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    return res.ok && !ctype.includes('mpegurl') && !ctype.includes('text/html');
  } catch {
    return false;
  }
}

async function extractDirectAudioStream(
  targetUrl: string,
  trackTitle: string
): Promise<YtStreamInfoJson> {
  const args = [
    targetUrl,
    '-f',
    STREAM_FORMAT_SELECTOR,
    '-j',
    '--no-playlist',
    '--no-warnings',
  ];

  const parseAndCheck = (stdout: string): YtStreamInfoJson => {
    const parsed = JSON.parse(stdout) as YtStreamInfoJson;
    if (!parsed.url) {
      throw new Error(`No stream URL extracted for "${trackTitle}"`);
    }
    if (
      /m3u8|hls/i.test(parsed.protocol || '') ||
      /\.m3u8(\?|$)/i.test(parsed.url)
    ) {
      throw new Error(`Unsupported HLS audio stream for "${trackTitle}"`);
    }
    return parsed;
  };

  const hasCookies = getYouTubeYtDlpCookieArgs().length > 0;
  try {
    const stdout = await execYtDlp(args, { timeoutMs: 25000 });
    const info = parseAndCheck(stdout);
    if (hasCookies && info.url) {
      const ok = await probeDirectStreamPlayable(info.url, info.http_headers ?? {});
      if (!ok) {
        throw new Error('Authenticated stream URL returned HTTP error');
      }
    }
    return info;
  } catch (err) {
    if (hasCookies) {
      try {
        const stdoutNoCookies = await execYtDlp(args, {
          timeoutMs: 25000,
          skipCookies: true,
        });
        return parseAndCheck(stdoutNoCookies);
      } catch {
        // Fall through to throw original error if unauthenticated retry also failed
      }
    }
    throw err;
  }
}

async function resolveStreamInternal(track: Track): Promise<StreamResolution> {
  const hydrated = libraryStore.hydrateTrack(track);

  if (hydrated.localPath && fs.existsSync(hydrated.localPath)) {
    return {
      url: mediaServer.getLocalAudioUrl(hydrated.localPath),
      isLocal: true,
      youtubeId: hydrated.youtubeId,
      actualDuration: hydrated.duration > 0 ? hydrated.duration : undefined,
    };
  }

  const cached = streamInfoCache.get(track.id);
  if (cached && Date.now() < cached.expiresAt) {
    const proxied = mediaServer.registerRemoteStream(
      track.id,
      cached.streamUrl,
      cached.headers
    );
    return {
      url: proxied,
      isLocal: false,
      youtubeId: cached.youtubeId,
      actualDuration: cached.actualDuration,
    };
  }

  const matched = await resolveBestYoutubeAudio(hydrated);
  const targetUrl =
    hydrated.sourceUrl &&
    !hydrated.sourceUrl.includes('itunes.apple.com') &&
    !hydrated.sourceUrl.includes('open.spotify.com')
      ? hydrated.sourceUrl
      : `https://www.youtube.com/watch?v=${matched.youtubeId}`;

  const info = await extractDirectAudioStream(targetUrl, track.title);
  if (!info.url) {
    throw new Error(`No stream URL extracted for "${track.title}"`);
  }

  const actualDuration = Math.round(
    info.duration || matched.matchedDuration || hydrated.duration || 0
  );
  const headers = info.http_headers ?? {};

  streamInfoCache.set(track.id, {
    streamUrl: info.url,
    headers,
    youtubeId: matched.youtubeId,
    actualDuration: actualDuration > 0 ? actualDuration : undefined,
    expiresAt: Date.now() + 25 * 60 * 1000,
  });

  const proxiedUrl = mediaServer.registerRemoteStream(track.id, info.url, headers);
  return {
    url: proxiedUrl,
    isLocal: false,
    youtubeId: matched.youtubeId,
    actualDuration: actualDuration > 0 ? actualDuration : undefined,
  };
}

export async function resolveTrackStream(track: Track): Promise<StreamResolution> {
  const existing = inFlightResolutions.get(track.id);
  if (existing) return existing;

  const promise = resolveStreamInternal(track).finally(() => {
    inFlightResolutions.delete(track.id);
  });
  inFlightResolutions.set(track.id, promise);
  return promise;
}

export function prefetchTrackStream(track: Track): void {
  const hydrated = libraryStore.hydrateTrack(track);
  if (hydrated.localPath && fs.existsSync(hydrated.localPath)) return;
  const cached = streamInfoCache.get(track.id);
  if (cached && Date.now() < cached.expiresAt) return;
  if (inFlightResolutions.has(track.id)) return;

  void resolveTrackStream(track).catch(() => {
    // Silent background prefetch failure is safe
  });
}
