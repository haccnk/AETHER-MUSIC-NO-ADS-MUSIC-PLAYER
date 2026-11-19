import { MusicVideoInfo, MvStreamPayload, Track } from '../../src/types/music';
import { execYtDlp } from './binaryManager';
import { mediaServer } from './mediaServer';
import {
  cleanSearchTerm,
  extractArtistTokens,
  hasCjk,
  hasJapanese,
  hasTokenMatch,
  normalizeCmp,
  parseClockDuration,
} from './streamService';

const mvCheckCache = new Map<string, MusicVideoInfo | null>();
const mvStreamCache = new Map<
  string,
  { payload: MvStreamPayload; expiresAt: number }
>();

const NON_MV_KEYWORDS = [
  'cover',
  'karaoke',
  'カラオケ',
  'lyric',
  'lyrics',
  'vietsub',
  'color coded',
  'colour coded',
  '가사',
  'reaction',
  'teaser',
  'trailer',
  'fancam',
  'dance practice',
  'choreography',
  '1 hour',
  '30min',
  'seamless',
  'slowed',
  'sped up',
  'nightcore',
  'hardstyle',
  'remix',
  'piano',
  'instrumental',
  'off vocal',
  'inst.',
  'live at',
  'english ver',
  'english version',
  'eng ver',
  'en ver',
];

function extractViewCount(metaLine: string): string | undefined {
  const parts = metaLine.split('•').map((p) => p.trim());
  return parts.find((p) => /view|lượt|回|次/i.test(p));
}

export async function checkOfficialMv(
  track: Track,
  audioYoutubeId?: string
): Promise<MusicVideoInfo | null> {
  const cacheKey = `${track.id}::${audioYoutubeId || ''}`;
  if (mvCheckCache.has(cacheKey)) {
    return mvCheckCache.get(cacheKey) ?? null;
  }

  const primaryArtist = track.artist.split(',')[0].split('&')[0].trim();
  const cleanTitle = cleanSearchTerm(track.title);
  const query = `${primaryArtist} ${cleanTitle}`.trim();
  if (!query) {
    mvCheckCache.set(cacheKey, null);
    return null;
  }

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
        params: 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D', // YouTube Music Official Videos filter
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      mvCheckCache.set(cacheKey, null);
      return null;
    }

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
    const artistTokens = extractArtistTokens(track);
    const trackLower = track.title.toLowerCase();

    let bestScore = -9999;
    let bestMv: MusicVideoInfo | null = null;

    for (const shelf of shelves) {
      const items = shelf?.musicShelfRenderer?.contents ?? [];
      for (let idx = 0; idx < Math.min(items.length, 5); idx++) {
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
        const metaParts = metaLine.split('•').map((p) => p.trim());
        const channel = metaParts[0] ?? '';
        const itemDur = parseClockDuration(metaLine);
        const itemTitleLower = itemTitle.toLowerCase();
        const channelLower = channel.toLowerCase();

        // Static audio Art Tracks / Topic videos are NOT Music Videos
        if (channel.endsWith('- Topic')) continue;
        if (
          audioYoutubeId &&
          vid === audioYoutubeId &&
          !/\b(mv|m\/v|music\s*video|official\s*video)\b/i.test(itemTitle)
        ) {
          continue;
        }

        // Strict exclusion of covers, lyric videos, karaoke, teasers, remixes, etc.
        let hasBanned = false;
        for (const kw of NON_MV_KEYWORDS) {
          if (
            (itemTitleLower.includes(kw) || channelLower.includes(kw)) &&
            !trackLower.includes(kw)
          ) {
            hasBanned = true;
            break;
          }
        }
        if (hasBanned) continue;
        if (!trackLower.includes('english') && /\benglish\b/i.test(itemTitleLower)) continue;

        // Duration sanity: real MVs shouldn't be truncated clips or 1-hour mixes
        if (track.duration > 20 && itemDur > 0) {
          const maxMvDur = Math.max(track.duration + 210, Math.round(track.duration * 2.2));
          if (itemDur < track.duration - 20 || itemDur > maxMvDur) continue;
        }

        const normChannel = normalizeCmp(channel);
        const normTitle = normalizeCmp(cleanSearchTerm(itemTitle));

        const channelMatched = hasTokenMatch(artistTokens, normChannel);
        const artistInTitleMatched = hasTokenMatch(artistTokens, normTitle);
        if (!channelMatched && !artistInTitleMatched) continue;

        let titleMatched = false;
        let score = 40 - idx * 8;
        if (channelMatched) score += 90;
        if (artistInTitleMatched) score += 35;

        if (wantTitle.length > 0 && normTitle.length > 0) {
          if (normTitle === wantTitle) {
            titleMatched = true;
            score += 100;
          } else if (
            wantTitle.length >= 2 &&
            normTitle.length >= 2 &&
            (normTitle.includes(wantTitle) || wantTitle.includes(normTitle))
          ) {
            titleMatched = true;
            score += 65;
          } else if (
            idx === 0 &&
            channelMatched &&
            hasCjk(itemTitle) !== hasCjk(cleanTitle) &&
            (track.duration <= 20 || itemDur <= 0 || Math.abs(itemDur - track.duration) <= 35)
          ) {
            // Top official channel cross-script MV (e.g. Rusino — ループザルーム vs Looping the Rooms)
            titleMatched = true;
            score += 55;
          }
        }

        if (!titleMatched) continue;

        if (track.duration > 20 && itemDur > 0) {
          const diff = Math.abs(itemDur - track.duration);
          if (diff <= 10) score += 60;
          else if (diff <= 35) score += 35;
        }
        if (/\b(mv|m\/v|music\s*video|official\s*video)\b/i.test(itemTitle)) {
          score += 25;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMv = {
            youtubeId: vid,
            title: itemTitle,
            channel,
            duration: itemDur || track.duration,
            thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            viewCountText: extractViewCount(metaLine),
          };
        }
      }
    }

    const result = bestScore >= 130 ? bestMv : null;
    mvCheckCache.set(cacheKey, result);
    return result;
  } catch {
    mvCheckCache.set(cacheKey, null);
    return null;
  }
}

export async function resolveMvStream(youtubeId: string): Promise<MvStreamPayload> {
  const cached = mvStreamCache.get(youtubeId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.payload;
  }

  const targetUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  const stdout = await execYtDlp(
    [
      targetUrl,
      '-f',
      'bestvideo[ext=webm][height<=1080][protocol=https]+bestaudio[ext=webm][format_note!*=dubbed][protocol=https]/bestvideo[ext=webm][height<=720][protocol=https]+bestaudio[ext=webm][protocol=https]/bestvideo[ext=mp4][height<=1080][protocol=https]+bestaudio[ext=m4a][format_note!*=dubbed][protocol=https]/18/best[ext=mp4][protocol=https]',
      '-j',
      '--no-playlist',
      '--no-warnings',
    ],
    { timeoutMs: 25000 }
  );

  const info = JSON.parse(stdout) as {
    url?: string;
    duration?: number;
    height?: number;
    http_headers?: Record<string, string>;
    requested_formats?: Array<{
      url?: string;
      height?: number;
      vcodec?: string;
      acodec?: string;
      http_headers?: Record<string, string>;
    }>;
  };

  let payload: MvStreamPayload | null = null;
  if (Array.isArray(info.requested_formats) && info.requested_formats.length >= 2) {
    const vFmt = info.requested_formats.find((f) => f.vcodec && f.vcodec !== 'none' && f.url);
    const aFmt = info.requested_formats.find(
      (f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none') && f.url
    );
    if (vFmt?.url && aFmt?.url) {
      const videoUrl = mediaServer.registerRemoteStream(
        `mv_v_${youtubeId}`,
        vFmt.url,
        vFmt.http_headers ?? info.http_headers ?? {}
      );
      const audioUrl = mediaServer.registerRemoteStream(
        `mv_a_${youtubeId}`,
        aFmt.url,
        aFmt.http_headers ?? info.http_headers ?? {}
      );
      payload = {
        videoUrl,
        audioUrl,
        resolution: vFmt.height ? `${vFmt.height}p HD` : 'HD',
        duration: info.duration ? Math.round(info.duration) : undefined,
      };
    }
  }

  if (!payload && info.url) {
    const videoUrl = mediaServer.registerRemoteStream(
      `mv_v_${youtubeId}`,
      info.url,
      info.http_headers ?? {}
    );
    payload = {
      videoUrl,
      resolution: info.height ? `${info.height}p HD` : 'SD',
      duration: info.duration ? Math.round(info.duration) : undefined,
    };
  }

  if (!payload) {
    throw new Error('No playable MV video stream found.');
  }

  mvStreamCache.set(youtubeId, {
    payload,
    expiresAt: Date.now() + 20 * 60 * 1000,
  });

  return payload;
}
