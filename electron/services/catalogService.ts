import {
  Album,
  DiscoverFeed,
  SearchResult,
  Track,
  UrlBatchParseResult,
} from '../../src/types/music';
import { execYtDlp } from './binaryManager';
import { isSpotifyInput, parseSpotifyUrl } from './spotifyService';
import { libraryStore } from './store';
import {
  cleanSearchTerm,
  extractArtistTokens,
  hasTokenMatch,
  normalizeCmp,
  parseClockDuration,
} from './streamService';

interface ITunesResult {
  wrapperType: string;
  collectionType?: string;
  collectionId?: number;
  trackId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  releaseDate?: string;
  trackCount?: number;
  trackNumber?: number;
  trackTimeMillis?: number;
  primaryGenreName?: string;
}

interface YtmRun {
  text?: string;
  navigationEndpoint?: {
    browseEndpoint?: {
      browseId?: string;
    };
  };
}

interface YtmThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

interface YtmFlexColumn {
  musicResponsiveListItemFlexColumnRenderer?: {
    text?: {
      runs?: YtmRun[];
    };
  };
}

interface YtmFixedColumn {
  musicResponsiveListItemFixedColumnRenderer?: {
    text?: {
      runs?: YtmRun[];
    };
  };
}

interface YtmListItemRenderer {
  playlistItemData?: {
    videoId?: string;
  };
  navigationEndpoint?: {
    browseEndpoint?: {
      browseId?: string;
    };
  };
  overlay?: {
    musicItemThumbnailOverlayRenderer?: {
      content?: {
        musicPlayButtonRenderer?: {
          playNavigationEndpoint?: {
            watchEndpoint?: {
              videoId?: string;
            };
          };
        };
      };
    };
  };
  thumbnail?: {
    musicThumbnailRenderer?: {
      thumbnail?: {
        thumbnails?: YtmThumbnail[];
      };
    };
  };
  flexColumns?: YtmFlexColumn[];
  fixedColumns?: YtmFixedColumn[];
}

interface YtmTwoRowItemRenderer {
  title?: { runs?: YtmRun[] };
  subtitle?: { runs?: YtmRun[] };
  navigationEndpoint?: {
    browseEndpoint?: {
      browseId?: string;
    };
  };
  thumbnailRenderer?: {
    musicThumbnailRenderer?: {
      thumbnail?: {
        thumbnails?: YtmThumbnail[];
      };
    };
  };
}

interface YtmShelfContentItem {
  musicResponsiveListItemRenderer?: YtmListItemRenderer;
  musicTwoRowItemRenderer?: YtmTwoRowItemRenderer;
}

interface YtmSectionItem {
  musicCarouselShelfRenderer?: {
    header?: {
      musicCarouselShelfBasicHeaderRenderer?: {
        title?: { runs?: YtmRun[] };
      };
    };
    contents?: YtmShelfContentItem[];
  };
  musicShelfRenderer?: {
    title?: { runs?: YtmRun[] };
    contents?: YtmShelfContentItem[];
  };
  musicPlaylistShelfRenderer?: {
    contents?: YtmShelfContentItem[];
  };
}

interface YtmHeaderRenderer {
  title?: { runs?: YtmRun[] };
  subtitle?: { runs?: YtmRun[] };
  secondSubtitle?: { runs?: YtmRun[] };
  straplineTextOne?: { runs?: YtmRun[] };
  thumbnail?: {
    musicThumbnailRenderer?: {
      thumbnail?: {
        thumbnails?: YtmThumbnail[];
      };
    };
  };
}

interface YtmBrowseResponse {
  contents?: {
    singleColumnBrowseResultsRenderer?: {
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: YtmSectionItem[];
            };
          };
        };
      }>;
    };
    twoColumnBrowseResultsRenderer?: {
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: Array<{
                musicResponsiveHeaderRenderer?: YtmHeaderRenderer;
              }>;
            };
          };
        };
      }>;
      secondaryContents?: {
        sectionListRenderer?: {
          contents?: YtmSectionItem[];
        };
      };
    };
  };
}

interface YtmSearchResponse {
  contents?: {
    tabbedSearchResultsRenderer?: {
      tabs?: Array<{
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: YtmSectionItem[];
            };
          };
        };
      }>;
    };
  };
}

const YTM_VN_TRENDING_PLAYLIST = 'VLOLAK5uy_lEos0zuYBvGC9C0FSGG3pZ6gO4a82P6zg';
const YTM_VN_TOP100_SONGS = 'VLPL4fGSI1pDJn4bRKr6tjRWaGlqRg_zY_is';
const YTM_HIT_LIST_PLAYLIST = 'VLRDCLAK5uy_njmsT2NZikZg8P4NsDYtghF9syAVb-TjM';
const YTM_RELEASED_PLAYLIST = 'VLRDCLAK5uy_mXSZ6uWtp8W7PC7QnwF2cY9RyD8zNd7DY';
const YTM_GLOBAL_CHART_FORM_VALUE =
  'EidleHBsb3JlX2NoYXJ0c19jb3VudHJ5X21lbnVfMzE2NzY2NTY3WlogkQEoAQ%3D%3D';
const YTM_SONGS_SEARCH_PARAMS = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';
const YTM_FEATURED_PLAYLISTS_PARAMS = 'EgeKAQQoADgBahIQChADEAUQBBAJEBUQDhAQEBE%3D';
const YTM_POP_CATEGORY_PARAMS = 'ggMPOg1uX1BmNzc2V2p0YXJ5';
const YTM_INDIE_CATEGORY_PARAMS = 'ggMPOg1uX21NWWpBbU01SDgy';

const ytmSingleFallbackCache = new Map<string, Album>();

function upgradeArtwork(url?: string, size = 600): string {
  if (!url) return '';
  return url.replace(
    /\/\d+x\d+(bb|mv|sr)?(-\d+)?\.(jpg|png|webp)$/i,
    `/${size}x${size}bb.$3`
  );
}

function upgradeYtmCover(url?: string, size = 600): string {
  const clean = normalizeImageUrl(url);
  if (!clean) return '';

  const ytMatch = /(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([a-zA-Z0-9_-]{11})\//i.exec(clean);
  if (ytMatch?.[1]) {
    return `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  if (clean.includes('googleusercontent.com')) {
    return clean
      .replace(/=w\d+-h\d+[^=]*$/i, `=w${size}-h${size}-l90-rj`)
      .replace(/=s\d+[^=]*$/i, `=s${size}`);
  }

  return clean;
}

function runsText(runs?: YtmRun[]): string {
  return (runs ?? []).map((r) => r.text ?? '').join('').trim();
}

function pickLastThumb(thumbs?: YtmThumbnail[]): string {
  if (!thumbs || thumbs.length === 0) return '';
  return thumbs[thumbs.length - 1]?.url ?? '';
}

function parseYtmYear(text?: string): string | undefined {
  if (!text) return undefined;
  const m = /\b(19\d{2}|20\d{2})\b/.exec(text);
  return m?.[1];
}

function isYtmMetaNoise(part: string): boolean {
  return (
    /lượt\s*(xem|phát)|views?|plays?|bài\s*hát|songs?|^\d+:\d{2}(?::\d{2})?$|^\d+\s+thg\s+\d+/i.test(
      part.trim()
    ) || part.trim().length === 0
  );
}

function cleanYtmSubtitleArtist(subtitle: string): string {
  const parts = subtitle
    .split('•')
    .map((p) => p.trim())
    .filter((p) => p && !/^(bảng xếp hạng|danh sách phát|đĩa nhạc|đĩa đơn|playlist|album|ep|single|đĩa nhạc mở rộng)/i.test(p) && !/^\d{4}$/.test(p) && !isYtmMetaNoise(p));
  return parts.join(' • ') || 'YouTube Music';
}

async function postYtm<T>(
  endpoint: 'browse' | 'search',
  body: Record<string, unknown>,
  opts: { gl?: string; hl?: string; timeoutMs?: number } = {}
): Promise<T | null> {
  const { gl = 'VN', hl = 'vi', timeoutMs = 8500 } = opts;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241118.01.00',
            hl,
            gl,
          },
        },
        ...body,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseYtmTrackRenderer(
  renderer: YtmListItemRenderer | undefined,
  defaults: {
    album?: string;
    albumId?: string;
    artist?: string;
    coverUrl?: string;
    year?: string;
    trackNumber?: number;
  } = {}
): Track | null {
  if (!renderer) return null;
  const videoId =
    renderer.playlistItemData?.videoId ||
    renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
      ?.playNavigationEndpoint?.watchEndpoint?.videoId;
  if (!videoId) return null;

  const colRuns = (renderer.flexColumns ?? []).map(
    (fc) => fc.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []
  );
  const cols = colRuns.map((runs) => runsText(runs));
  const title = cols[0];
  if (!title) return null;

  const col1Parts = (cols[1] ?? '')
    .split('•')
    .map((p) => p.trim())
    .filter(Boolean);
  const albumRun = colRuns[1]?.find((r) =>
    r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb_')
  );

  const artistParts = col1Parts.filter(
    (p) => !isYtmMetaNoise(p) && (!albumRun?.text || p !== albumRun.text)
  );
  const artist = artistParts[0] || defaults.artist || 'YouTube Music';

  const col2Clean = cols[2] && !isYtmMetaNoise(cols[2]) ? cols[2] : undefined;
  const albumName = albumRun?.text || col2Clean || defaults.album || 'YouTube Music';
  const albumId = albumRun?.navigationEndpoint?.browseEndpoint?.browseId
    ? `ytm_${albumRun.navigationEndpoint.browseEndpoint.browseId}`
    : defaults.albumId;

  const fixedDurText = runsText(
    renderer.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs
  );
  const duration = parseClockDuration(fixedDurText) || parseClockDuration(cols[1] ?? '');

  const rawThumb = pickLastThumb(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
  const coverUrl =
    upgradeYtmCover(rawThumb, 600) ||
    defaults.coverUrl ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return libraryStore.hydrateTrack({
    id: `yt_${videoId}`,
    youtubeId: videoId,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    artist,
    album: albumName,
    albumId,
    duration,
    coverUrl,
    trackNumber: defaults.trackNumber,
    year: defaults.year,
    sourceType: 'youtube',
  });
}

function parseYtmTwoRowToAlbum(
  item: YtmTwoRowItemRenderer | undefined,
  fallbackArtist = 'YouTube Music'
): Album | null {
  const browseId = item?.navigationEndpoint?.browseEndpoint?.browseId;
  if (!browseId || (!browseId.startsWith('VL') && !browseId.startsWith('MPREb_'))) {
    return null;
  }
  const title = runsText(item.title?.runs);
  if (!title) return null;
  const subtitle = runsText(item.subtitle?.runs);
  const coverUrl = upgradeYtmCover(
    pickLastThumb(item.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    600
  );
  return {
    id: `ytm_${browseId}`,
    title,
    artist: cleanYtmSubtitleArtist(subtitle) || fallbackArtist,
    coverUrl,
    year: parseYtmYear(subtitle),
    source: 'youtube',
  };
}

function parseYtmSearchPlaylistToAlbum(renderer: YtmListItemRenderer | undefined): Album | null {
  const browseId = renderer?.navigationEndpoint?.browseEndpoint?.browseId;
  if (!browseId || !browseId.startsWith('VL')) return null;

  const cols = (renderer.flexColumns ?? []).map((fc) =>
    runsText(fc.musicResponsiveListItemFlexColumnRenderer?.text?.runs)
  );
  const title = cols[0];
  if (!title) return null;

  const coverUrl = upgradeYtmCover(
    pickLastThumb(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    600
  );
  const subtitle = cols[1] ?? '';

  return {
    id: `ytm_${browseId}`,
    title,
    artist: cleanYtmSubtitleArtist(subtitle),
    coverUrl,
    year: parseYtmYear(subtitle),
    source: 'youtube',
  };
}

function isCleanTrendingSongCandidate(track: Track): boolean {
  if (track.duration > 600) return false;
  if (
    /\b(liên khúc|nonstop|tuyển tập|nhạc chế|full album|\d+\s*(bài|ca khúc|in\s*\d+)|nhạc lộn xộn|mashup.*tiktok|giọng ca \d+ năm|phố nhạc việt)\b/i.test(
      `${track.title} ${track.artist}`
    )
  ) {
    return false;
  }
  return true;
}

const UNSOLICITED_DISCOVER_VARIANTS = [
  'remix',
  'vinahouse',
  'cover',
  'karaoke',
  'slowed',
  'sped up',
  'nightcore',
  'quá tam ba bận',
  'nhưng lên là phải',
  'lofi',
  '8d',
];

async function enrichYtmChartTrack(track: Track): Promise<Track> {
  const cleanArtist = track.artist
    .replace(/\s+và\s+/gi, ' ')
    .replace(/\s*[,&×]\s*/g, ' ')
    .trim();
  const cleanTitle = cleanSearchTerm(track.title);
  const query = `${cleanArtist} ${cleanTitle}`.trim();
  if (!query) return track;

  const res = await postYtm<YtmSearchResponse>(
    'search',
    { query, params: YTM_SONGS_SEARCH_PARAMS },
    { timeoutMs: 6000 }
  );

  const shelves =
    res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents ?? [];
  const shelf = shelves.find((s) => s.musicShelfRenderer)?.musicShelfRenderer;
  const items = shelf?.contents ?? [];
  if (items.length === 0) return track;

  const wantTitle = normalizeCmp(cleanTitle);
  const artistTokens = extractArtistTokens({
    ...track,
    artist: track.artist.replace(/\s+và\s+/gi, ', '),
  });
  const origLower = track.title.toLowerCase();

  for (const item of items.slice(0, 3)) {
    const renderer = item.musicResponsiveListItemRenderer;
    const vid = renderer?.playlistItemData?.videoId;
    if (!vid) continue;

    const colRuns = (renderer.flexColumns ?? []).map(
      (fc) => fc.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []
    );
    const candTitle = runsText(colRuns[0]);
    const candMeta = runsText(colRuns[1]);
    if (!candTitle) continue;

    const candLower = candTitle.toLowerCase();
    if (
      UNSOLICITED_DISCOVER_VARIANTS.some(
        (kw) => candLower.includes(kw) && !origLower.includes(kw)
      )
    ) {
      continue;
    }

    const candDur = parseClockDuration(candMeta);
    const normCandTitle = normalizeCmp(cleanSearchTerm(candTitle));
    const normCandMeta = normalizeCmp(candMeta);
    const exactTitleOk = wantTitle.length >= 2 && normCandTitle === wantTitle;
    const titleOk =
      exactTitleOk ||
      (wantTitle.length >= 2 &&
        normCandTitle.length >= 2 &&
        (normCandTitle.includes(wantTitle) || wantTitle.includes(normCandTitle)));
    const artistOk = hasTokenMatch(artistTokens, normCandMeta);

    if (!titleOk && !artistOk) continue;

    // Allow Music Videos (which often have 30-110s story intros) to match their studio Art Track when title & artist both match
    if (track.duration > 20 && candDur > 20) {
      const maxDiff = exactTitleOk && artistOk ? 120 : 25;
      if (Math.abs(candDur - track.duration) > maxDiff) continue;
    }
    if (!titleOk && track.duration > 20 && candDur > 0 && Math.abs(candDur - track.duration) > 10) {
      continue;
    }

    const albumRun = colRuns[1]?.find((r) =>
      r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb_')
    );
    const squareCover = upgradeYtmCover(
      pickLastThumb(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
      600
    );
    const metaParts = candMeta.split('•').map((p) => p.trim());
    const cleanCandArtist =
      metaParts[0] && !isYtmMetaNoise(metaParts[0]) ? metaParts[0] : track.artist;

    return libraryStore.hydrateTrack({
      ...track,
      id: `yt_${vid}`,
      youtubeId: vid,
      sourceUrl: `https://www.youtube.com/watch?v=${vid}`,
      artist: cleanCandArtist,
      album: albumRun?.text || track.album,
      albumId: albumRun?.navigationEndpoint?.browseEndpoint?.browseId
        ? `ytm_${albumRun.navigationEndpoint.browseEndpoint.browseId}`
        : track.albumId,
      duration: candDur > 0 ? candDur : track.duration,
      coverUrl: squareCover || track.coverUrl,
      sourceType: 'youtube',
    });
  }

  return track;
}

async function fetchYtmBrowseAlbumOrPlaylist(rawBrowseId: string): Promise<Album | null> {
  const data = await postYtm<YtmBrowseResponse>('browse', { browseId: rawBrowseId });
  const twoCol = data?.contents?.twoColumnBrowseResultsRenderer;
  if (!twoCol) return null;

  const header =
    twoCol.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
      ?.musicResponsiveHeaderRenderer;
  const title = runsText(header?.title?.runs) || 'YouTube Music';
  const subtitle = runsText(header?.subtitle?.runs);
  const strapline = runsText(header?.straplineTextOne?.runs);
  const artist = strapline || cleanYtmSubtitleArtist(subtitle) || 'YouTube Music';
  const year = parseYtmYear(subtitle);
  const coverUrl = upgradeYtmCover(
    pickLastThumb(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    800
  );

  const secContents = twoCol.secondaryContents?.sectionListRenderer?.contents ?? [];
  const shelfItems =
    secContents.find((s) => s.musicPlaylistShelfRenderer)?.musicPlaylistShelfRenderer?.contents ??
    secContents.find((s) => s.musicShelfRenderer)?.musicShelfRenderer?.contents ??
    [];

  const albumId = `ytm_${rawBrowseId}`;
  const tracks: Track[] = [];
  for (let i = 0; i < shelfItems.length; i++) {
    const tr = parseYtmTrackRenderer(shelfItems[i]?.musicResponsiveListItemRenderer, {
      album: title,
      albumId,
      artist,
      coverUrl,
      year,
      trackNumber: i + 1,
    });
    if (tr) tracks.push(tr);
  }

  return {
    id: albumId,
    title,
    artist,
    coverUrl: coverUrl || tracks[0]?.coverUrl || '',
    year,
    trackCount: tracks.length,
    tracks,
    source: 'youtube',
  };
}

function mapItunesAlbum(item: ITunesResult, artworkSize = 600): Album {
  return {
    id: `itunes_${item.collectionId}`,
    title: item.collectionName || 'Unknown Album',
    artist: item.artistName || 'Unknown Artist',
    coverUrl: upgradeArtwork(item.artworkUrl100, artworkSize),
    year: item.releaseDate ? item.releaseDate.slice(0, 4) : undefined,
    trackCount: item.trackCount ?? undefined,
    genre: item.primaryGenreName,
    source: 'catalog',
  };
}

function mapItunesTrack(item: ITunesResult, artworkSize = 600): Track {
  const track: Track = {
    id: `itunes_tr_${item.trackId}`,
    title: item.trackName || 'Unknown Track',
    artist: item.artistName || 'Unknown Artist',
    album: item.collectionName || 'Singles',
    albumId: item.collectionId ? `itunes_${item.collectionId}` : undefined,
    duration: Math.round((item.trackTimeMillis ?? 0) / 1000),
    coverUrl: upgradeArtwork(item.artworkUrl100, artworkSize),
    trackNumber: item.trackNumber,
    year: item.releaseDate ? item.releaseDate.slice(0, 4) : undefined,
    sourceType: 'catalog',
  };
  return libraryStore.hydrateTrack(track);
}

let cachedFeed: { feed: DiscoverFeed; at: number } | null = null;

async function fetchItunesJson(url: string): Promise<ITunesResult[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: ITunesResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function getDiscoverFeed(): Promise<DiscoverFeed> {
  if (cachedFeed && Date.now() - cachedFeed.at < 15 * 60 * 1000) {
    return {
      ...cachedFeed.feed,
      trendingTracks: cachedFeed.feed.trendingTracks.map((t) => libraryStore.hydrateTrack(t)),
    };
  }

  const [
    vnTrendingPlaylist,
    vnTop100Playlist,
    exploreRes,
    vnChartsRes,
    vnChartSearchRes,
    globalChartsRes,
    popCatRes,
    indieCatRes,
    hitListAlbum,
    releasedAlbum,
  ] = await Promise.all([
    fetchYtmBrowseAlbumOrPlaylist(YTM_VN_TRENDING_PLAYLIST),
    fetchYtmBrowseAlbumOrPlaylist(YTM_VN_TOP100_SONGS),
    postYtm<YtmBrowseResponse>('browse', { browseId: 'FEmusic_explore' }),
    postYtm<YtmBrowseResponse>('browse', { browseId: 'FEmusic_charts' }),
    postYtm<YtmSearchResponse>('search', {
      query: 'Nhạc Việt',
      params: YTM_FEATURED_PLAYLISTS_PARAMS,
    }),
    postYtm<YtmBrowseResponse>('browse', {
      browseId: 'FEmusic_charts',
      formData: { selectedValues: [YTM_GLOBAL_CHART_FORM_VALUE] },
    }),
    postYtm<YtmBrowseResponse>('browse', {
      browseId: 'FEmusic_moods_and_genres_category',
      params: YTM_POP_CATEGORY_PARAMS,
    }),
    postYtm<YtmBrowseResponse>('browse', {
      browseId: 'FEmusic_moods_and_genres_category',
      params: YTM_INDIE_CATEGORY_PARAMS,
    }),
    fetchYtmBrowseAlbumOrPlaylist(YTM_HIT_LIST_PLAYLIST),
    fetchYtmBrowseAlbumOrPlaylist(YTM_RELEASED_PLAYLIST),
  ]);

  // 1. Collect live Vietnam trending tracks (Trending 20 -> Explore Trending -> Top 100 VN)
  const exploreSections =
    exploreRes?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents ?? [];
  const exploreTrendingItems =
    exploreSections.find((s) =>
      /thịnh hành|trending/i.test(
        runsText(s.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs)
      )
    )?.musicCarouselShelfRenderer?.contents ?? [];

  const exploreTracks = exploreTrendingItems
    .map((it, idx) =>
      parseYtmTrackRenderer(it.musicResponsiveListItemRenderer, {
        album: 'Thịnh hành Việt Nam',
        trackNumber: idx + 1,
      })
    )
    .filter((t): t is Track => Boolean(t));

  const rawTrendingPool: Track[] = [
    ...(vnTrendingPlaylist?.tracks ?? []),
    ...exploreTracks,
    ...(vnTop100Playlist?.tracks ?? []).slice(0, 20),
  ];

  const seenTrackKeys = new Set<string>();
  const cleanTrendingPool: Track[] = [];
  for (const tr of rawTrendingPool) {
    if (!isCleanTrendingSongCandidate(tr)) continue;
    const key = `${normalizeCmp(cleanSearchTerm(tr.title))}::${normalizeCmp(tr.artist.split(/,|và|&/i)[0] ?? '')}`;
    if (seenTrackKeys.has(tr.id) || seenTrackKeys.has(key)) continue;
    seenTrackKeys.add(tr.id);
    seenTrackKeys.add(key);
    cleanTrendingPool.push(tr);
  }

  const trendingTracks = await Promise.all(cleanTrendingPool.slice(0, 12).map(enrichYtmChartTrack));

  // 2. Featured Hero: #1 fastest-rising / top trending song today in Vietnam
  let featuredAlbum: Album | null = null;
  const topTrending = trendingTracks[0];
  if (topTrending) {
    if (topTrending.albumId?.startsWith('ytm_MPREb_')) {
      const detailed = await fetchYtmBrowseAlbumOrPlaylist(
        topTrending.albumId.replace(/^ytm_/, '')
      );
      if (detailed && (detailed.tracks?.length ?? 0) > 0) {
        if ((detailed.tracks?.length ?? 0) > 1 && detailed.title !== topTrending.title) {
          featuredAlbum = {
            id: `ytm_single_${topTrending.youtubeId || topTrending.id}`,
            title: topTrending.title,
            artist: topTrending.artist,
            coverUrl: upgradeYtmCover(topTrending.coverUrl, 800),
            year: detailed.year || String(new Date().getFullYear()),
            trackCount: 1,
            tracks: [topTrending],
            source: 'youtube',
          };
          ytmSingleFallbackCache.set(featuredAlbum.id, featuredAlbum);
        } else {
          featuredAlbum = {
            ...detailed,
            coverUrl: upgradeYtmCover(detailed.coverUrl || topTrending.coverUrl, 800),
            tracks: detailed.tracks?.length === 1 ? [topTrending] : detailed.tracks,
          };
        }
      }
    }
    if (!featuredAlbum) {
      featuredAlbum = {
        id: `ytm_single_${topTrending.youtubeId || topTrending.id}`,
        title: topTrending.title,
        artist: topTrending.artist,
        coverUrl: upgradeYtmCover(topTrending.coverUrl, 800),
        year: topTrending.year || String(new Date().getFullYear()),
        trackCount: 1,
        tracks: [topTrending],
        source: 'youtube',
      };
      ytmSingleFallbackCache.set(featuredAlbum.id, featuredAlbum);
    }
  }

  // 3. "Thịnh hành tại Việt Nam" cards: official VN YouTube Charts + curated VN playlists + top trending singles/EPs
  const extractCarouselCards = (
    resp: YtmBrowseResponse | null,
    titleRegex: RegExp,
    fallbackArtist: string
  ): Album[] => {
    const secs =
      resp?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.sectionListRenderer?.contents ?? [];
    const matching = secs.filter((s) =>
      titleRegex.test(
        runsText(s.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs)
      )
    );
    const out: Album[] = [];
    for (const sec of matching) {
      for (const item of sec.musicCarouselShelfRenderer?.contents ?? []) {
        const alb = parseYtmTwoRowToAlbum(item.musicTwoRowItemRenderer, fallbackArtist);
        if (alb) out.push(alb);
      }
    }
    return out;
  };

  const vnChartsCards = extractCarouselCards(vnChartsRes, /bảng xếp hạng|charts/i, 'YouTube Charts');
  const vnSearchChartShelves =
    vnChartSearchRes?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents ?? [];
  const vnSearchChartCards = (
    vnSearchChartShelves.find((s) => s.musicShelfRenderer)?.musicShelfRenderer?.contents ?? []
  )
    .map((it) => parseYtmSearchPlaylistToAlbum(it.musicResponsiveListItemRenderer))
    .filter((a): a is Album => Boolean(a));

  const flagshipVnCards: Album[] = [];
  for (const pl of [hitListAlbum, releasedAlbum]) {
    if (pl) {
      flagshipVnCards.push({
        id: pl.id,
        title: pl.title,
        artist: pl.artist,
        coverUrl: pl.coverUrl,
        year: pl.year,
        trackCount: pl.trackCount,
        source: 'youtube',
      });
    }
  }

  const trendingReleaseCards: Album[] = [];
  for (const tr of trendingTracks.slice(1)) {
    if (!tr.albumId?.startsWith('ytm_MPREb_')) continue;
    if (featuredAlbum && tr.albumId === featuredAlbum.id) continue;
    trendingReleaseCards.push({
      id: tr.albumId,
      title: tr.album,
      artist: tr.artist,
      coverUrl: tr.coverUrl,
      year: String(new Date().getFullYear()),
      source: 'youtube',
    });
  }

  const dedupeAlbumCards = (list: Album[], limit: number): Album[] => {
    const seen = new Set<string>();
    const out: Album[] = [];
    for (const alb of list) {
      if (!alb.id || seen.has(alb.id)) continue;
      seen.add(alb.id);
      out.push(alb);
      if (out.length >= limit) break;
    }
    return out;
  };

  const vnTop100Card = vnSearchChartCards.find((a) =>
    a.id === `ytm_${YTM_VN_TOP100_SONGS}`
  );
  const vnShortsDailyCard = vnSearchChartCards.find((a) =>
    /shorts.*ngày|shorts.*daily/i.test(a.title)
  );
  const vnChartRow = dedupeAlbumCards(
    [
      ...(vnChartsCards[0] ? [vnChartsCards[0]] : []),
      ...(vnTop100Card ? [vnTop100Card] : []),
      ...flagshipVnCards,
      ...vnChartsCards.slice(1),
      ...(vnShortsDailyCard ? [vnShortsDailyCard] : []),
    ],
    5
  );
  const vnAlbums = dedupeAlbumCards(
    [...vnChartRow, ...trendingReleaseCards, ...vnSearchChartCards],
    10
  );

  // 4. "Thịnh hành Quốc tế" cards: Global YouTube Charts + curated Pop & Indie Hotlists
  const globalChartsCards = extractCarouselCards(
    globalChartsRes,
    /bảng xếp hạng|charts/i,
    'YouTube Charts'
  );
  const popHotlists = extractCarouselCards(
    popCatRes,
    /danh sách phát nổi bật|featured playlists/i,
    'YouTube Music'
  );
  const indieHotlists = extractCarouselCards(
    indieCatRes,
    /danh sách phát nổi bật|featured playlists/i,
    'YouTube Music'
  );

  const intlAlbums = dedupeAlbumCards(
    [...globalChartsCards, ...popHotlists.slice(0, 6), ...indieHotlists.slice(0, 4)],
    10
  );

  if (!featuredAlbum) {
    featuredAlbum = vnAlbums[0] ?? intlAlbums[0] ?? null;
  }

  const feed: DiscoverFeed = {
    featuredAlbum,
    vnAlbums,
    intlAlbums,
    trendingTracks,
  };

  if (vnAlbums.length > 0 || intlAlbums.length > 0 || trendingTracks.length > 0) {
    cachedFeed = { feed, at: Date.now() };
  }
  return feed;
}

export async function searchCatalog(query: string): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { albums: [], tracks: [] };

  if (isSpotifyInput(trimmed)) {
    try {
      const sp = await parseSpotifyUrl(trimmed);
      const album: Album = {
        id: sp.tracks[0]?.albumId || `sp_batch_${Date.now()}`,
        title: sp.title,
        artist: sp.artist,
        coverUrl: sp.coverUrl,
        trackCount: sp.tracks.length,
        tracks: sp.tracks,
        source: 'spotify',
      };
      return {
        albums: sp.tracks.length > 1 ? [album] : [],
        tracks: sp.tracks,
      };
    } catch {
      return { albums: [], tracks: [] };
    }
  }

  const hasJp = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u.test(trimmed);

  const [
    albumResultsJP,
    albumResultsVN,
    albumResultsUS,
    trackResultsJP,
    trackResultsVN,
    trackResultsUS,
  ] = await Promise.all([
    hasJp
      ? fetchItunesJson(
          `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&country=JP&entity=album&limit=10`
        )
      : Promise.resolve([]),
    fetchItunesJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&country=VN&entity=album&limit=10`
    ),
    fetchItunesJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&country=US&entity=album&limit=10`
    ),
    hasJp
      ? fetchItunesJson(
          `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&country=JP&entity=song&limit=12`
        )
      : Promise.resolve([]),
    fetchItunesJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&country=VN&entity=song&limit=12`
    ),
    fetchItunesJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&country=US&entity=song&limit=12`
    ),
  ]);

  const albumMap = new Map<number, Album>();
  for (const r of [...albumResultsJP, ...albumResultsVN, ...albumResultsUS]) {
    if (r.collectionId && !albumMap.has(r.collectionId)) {
      albumMap.set(r.collectionId, mapItunesAlbum(r, 600));
    }
  }

  const trackMap = new Map<number, Track>();
  for (const r of [...trackResultsJP, ...trackResultsVN, ...trackResultsUS]) {
    if (r.trackId && !trackMap.has(r.trackId)) {
      trackMap.set(r.trackId, mapItunesTrack(r, 600));
    }
  }

  return {
    albums: [...albumMap.values()].slice(0, 16),
    tracks: [...trackMap.values()].slice(0, 20),
  };
}

export async function getAlbumDetails(albumId: string): Promise<Album | null> {
  if (albumId.startsWith('ytm_')) {
    if (albumId.startsWith('ytm_single_')) {
      return ytmSingleFallbackCache.get(albumId) ?? null;
    }
    const rawBrowseId = albumId.replace(/^ytm_/, '');
    return fetchYtmBrowseAlbumOrPlaylist(rawBrowseId);
  }

  if (albumId.startsWith('itunes_')) {
    const rawId = albumId.replace('itunes_', '');

    // Try VN storefront first (fixes missing tracklists for V-Pop albums like Wren Evans / Vũ.)
    let results = await fetchItunesJson(
      `https://itunes.apple.com/lookup?id=${encodeURIComponent(rawId)}&country=VN&entity=song`
    );
    if (results.filter((r) => r.wrapperType === 'track').length === 0) {
      results = await fetchItunesJson(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(rawId)}&country=US&entity=song`
      );
    }
    if (results.length === 0) return null;

    const collection = results.find((r) => r.wrapperType === 'collection') ?? results[0];
    const songs = results
      .filter((r) => r.wrapperType === 'track' && r.trackId)
      .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0))
      .map((r) => mapItunesTrack(r, 600));

    const album = mapItunesAlbum(collection, 1000);
    album.tracks = songs;
    album.trackCount = songs.length || album.trackCount;
    return album;
  }

  if (albumId.startsWith('deezer_')) {
    const rawId = albumId.replace('deezer_', '');
    try {
      const res = await fetch(`https://api.deezer.com/album/${encodeURIComponent(rawId)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        id: number;
        title: string;
        cover_xl?: string;
        cover_big?: string;
        release_date?: string;
        artist?: { name: string };
        tracks?: {
          data: Array<{
            id: number;
            title: string;
            duration: number;
            track_position?: number;
            artist?: { name: string };
          }>;
        };
      };
      const cover = data.cover_xl || data.cover_big || '';
      const tracks: Track[] = (data.tracks?.data ?? []).map((t, i) =>
        libraryStore.hydrateTrack({
          id: `deezer_tr_${t.id}`,
          title: t.title,
          artist: t.artist?.name || data.artist?.name || 'Unknown Artist',
          album: data.title,
          albumId,
          duration: t.duration || 0,
          coverUrl: cover,
          trackNumber: t.track_position ?? i + 1,
          year: data.release_date?.slice(0, 4),
          sourceType: 'catalog',
        })
      );
      return {
        id: albumId,
        title: data.title,
        artist: data.artist?.name || 'Unknown Artist',
        coverUrl: cover,
        year: data.release_date?.slice(0, 4),
        trackCount: tracks.length,
        tracks,
        source: 'catalog',
      };
    } catch {
      return null;
    }
  }

  return null;
}

interface YtFlatEntry {
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  artist?: string;
  album?: string;
  duration?: number;
  url?: string;
  webpage_url?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; width?: number }>;
}

function normalizeImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function pickYtCover(entry: YtFlatEntry, fallback = ''): string {
  // Always prefer stable hqdefault.jpg for 11-char YouTube video IDs (signed sqp URLs expire/404)
  if (entry.id && /^[a-zA-Z0-9_-]{11}$/.test(entry.id)) {
    return `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
  }
  if (entry.thumbnail) return normalizeImageUrl(entry.thumbnail);
  if (entry.thumbnails && entry.thumbnails.length > 0) {
    const sorted = [...entry.thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    if (sorted[0]?.url) return normalizeImageUrl(sorted[0].url);
  }
  return fallback;
}

function cleanYtTitleAndArtist(rawTitle: string, rawUploader: string): { title: string; artist: string } {
  let artist = rawUploader.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim() || 'Unknown Artist';
  let title = rawTitle.trim();

  const dashIdx = title.indexOf(' - ');
  if (dashIdx > 1 && dashIdx < 45) {
    const left = title.slice(0, dashIdx).trim();
    const right = title.slice(dashIdx + 3).trim();
    if (right.length > 1) {
      if (
        artist === 'Unknown Artist' ||
        artist.toLowerCase().includes('music') ||
        artist.toLowerCase().includes('official')
      ) {
        artist = left;
        title = right;
      }
    }
  }

  return { title, artist };
}

export async function searchYouTubeMusic(query: string): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const stdout = await execYtDlp(
    [`ytsearch16:${trimmed}`, '--flat-playlist', '--dump-json', '--no-warnings'],
    { timeoutMs: 25000 }
  );

  const tracks: Track[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as YtFlatEntry;
      if (!entry.id || !entry.title) continue;
      if (entry.duration && entry.duration > 1800) continue;

      const { title, artist } = cleanYtTitleAndArtist(
        entry.title,
        entry.artist || entry.channel || entry.uploader || 'YouTube Music'
      );

      tracks.push(
        libraryStore.hydrateTrack({
          id: `yt_${entry.id}`,
          youtubeId: entry.id,
          sourceUrl: entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
          title,
          artist,
          album: entry.album || 'YouTube Music',
          duration: Math.round(entry.duration ?? 0),
          coverUrl: pickYtCover(entry),
          sourceType: 'youtube',
        })
      );
    } catch {
      // Ignore malformed line
    }
  }
  return tracks;
}

export async function parseUrlBatch(url: string): Promise<UrlBatchParseResult> {
  const cleanUrl = url.trim();
  if (isSpotifyInput(cleanUrl)) {
    return parseSpotifyUrl(cleanUrl);
  }

  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error('Invalid URL');
  }

  const stdout = await execYtDlp(
    [cleanUrl, '--flat-playlist', '--dump-single-json', '--no-warnings'],
    { timeoutMs: 35000 }
  );

  const data = JSON.parse(stdout) as {
    title?: string;
    uploader?: string;
    channel?: string;
    artist?: string;
    webpage_url?: string;
    thumbnail?: string;
    thumbnails?: Array<{ url: string; width?: number }>;
    entries?: YtFlatEntry[];
    id?: string;
    duration?: number;
  };

  const playlistCover = pickYtCover(data);
  const playlistTitle = (data.title || 'Album / Playlist').replace(/^Album - /i, '').trim();
  const playlistArtist = (data.artist || data.uploader || data.channel || 'Various Artists')
    .replace(/ - Topic$/i, '')
    .trim();

  const rawEntries: YtFlatEntry[] =
    Array.isArray(data.entries) && data.entries.length > 0
      ? data.entries
      : data.id
        ? [data]
        : [];

  const tracks: Track[] = [];
  let idx = 1;
  for (const entry of rawEntries) {
    if (!entry || (!entry.id && !entry.url)) continue;
    if (entry.title === '[Private video]' || entry.title === '[Deleted video]') continue;

    const fallbackUploader = entry.artist || entry.channel || entry.uploader || playlistArtist;
    const { title, artist } = cleanYtTitleAndArtist(entry.title || `Track ${idx}`, fallbackUploader);
    const ytId = entry.id && /^[a-zA-Z0-9_-]{11}$/.test(entry.id) ? entry.id : undefined;

    tracks.push(
      libraryStore.hydrateTrack({
        id: ytId ? `yt_${ytId}` : `url_${Date.now()}_${idx}`,
        youtubeId: ytId,
        sourceUrl:
          entry.webpage_url ||
          entry.url ||
          (ytId ? `https://www.youtube.com/watch?v=${ytId}` : cleanUrl),
        title,
        artist,
        album: playlistTitle,
        duration: Math.round(entry.duration ?? 0),
        coverUrl: pickYtCover(entry, playlistCover),
        trackNumber: idx,
        sourceType: 'youtube',
      })
    );
    idx++;
  }

  return {
    title: playlistTitle,
    artist: playlistArtist,
    coverUrl: playlistCover || tracks[0]?.coverUrl || '',
    sourceUrl: cleanUrl,
    tracks,
    provider: cleanUrl.includes('youtu') ? 'youtube' : 'other',
  };
}
