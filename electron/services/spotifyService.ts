import { Track, UrlBatchParseResult } from '../../src/types/music';
import { getSpotifyCookieHeader } from './authService';
import { libraryStore } from './store';

type SpotifyEntityKind = 'album' | 'playlist' | 'track';

interface SpotifyVisualImage {
  url?: string;
  maxWidth?: number;
  maxHeight?: number;
}

interface SpotifyTrackItem {
  uri?: string;
  uid?: string;
  title?: string;
  subtitle?: string;
  duration?: number;
}

interface SpotifyEmbedEntity {
  name?: string;
  title?: string;
  subtitle?: string;
  releaseDate?: { isoString?: string };
  duration?: number;
  artists?: Array<{ name?: string }>;
  visualIdentity?: { image?: SpotifyVisualImage[] };
  coverArt?: { sources?: SpotifyVisualImage[] };
  trackList?: SpotifyTrackItem[];
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function isSpotifyInput(input: string): boolean {
  const s = input.trim();
  return (
    /open\.spotify\.com/i.test(s) ||
    /spotify\.link/i.test(s) ||
    /spoti\.fi/i.test(s) ||
    /^spotify:(album|playlist|track):[a-zA-Z0-9]{22}$/i.test(s)
  );
}

function cleanText(raw?: string): string {
  return (raw || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function upgradeSpotifyCover(url?: string): string {
  if (!url) return '';
  return url
    .replace(/00001e02/g, '0000b273')
    .replace(/00004851/g, '0000b273');
}

function pickEntityCover(entity: SpotifyEmbedEntity): string {
  const images = [
    ...(entity.visualIdentity?.image ?? []),
    ...(entity.coverArt?.sources ?? []),
  ];
  if (images.length > 0) {
    const sorted = [...images].sort((a, b) => (b.maxWidth ?? 0) - (a.maxWidth ?? 0));
    const url = sorted[0]?.url;
    if (url) return upgradeSpotifyCover(url);
  }
  return '';
}

async function resolveSpotifyShortlink(input: string): Promise<string> {
  if (/spotify\.link|spoti\.fi/i.test(input)) {
    try {
      const res = await fetch(input, {
        redirect: 'follow',
        headers: { 'User-Agent': BROWSER_UA },
      });
      if (res.url) return res.url;
    } catch {
      // Keep original input
    }
  }
  return input;
}

function extractSpotifyId(
  input: string
): { kind: SpotifyEntityKind; id: string } | null {
  const match =
    /(?:open\.spotify\.com\/(?:intl-[a-z0-9-]+\/)?(?:embed\/)?|spotify:)(album|playlist|track)[/:]([a-zA-Z0-9]{22})/i.exec(
      input
    );
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as SpotifyEntityKind,
    id: match[2],
  };
}

export async function parseSpotifyUrl(rawInput: string): Promise<UrlBatchParseResult> {
  const resolved = await resolveSpotifyShortlink(rawInput.trim());
  const parsed = extractSpotifyId(resolved);
  if (!parsed) {
    throw new Error('Invalid Spotify Album, Playlist, or Track URL.');
  }

  const embedUrl = `https://open.spotify.com/embed/${parsed.kind}/${parsed.id}`;
  const spCookie = getSpotifyCookieHeader();
  const reqHeaders: Record<string, string> = { 'User-Agent': BROWSER_UA };
  if (spCookie) {
    reqHeaders.Cookie = spCookie;
  }
  const html = await fetch(embedUrl, {
    headers: reqHeaders,
  }).then((r) => {
    if (!r.ok) throw new Error(`Spotify returned HTTP ${r.status}`);
    return r.text();
  });

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Could not extract Spotify metadata payload.');
  }

  const nextJson = JSON.parse(match[1]) as {
    props?: { pageProps?: { state?: { data?: { entity?: SpotifyEmbedEntity } } } };
  };
  const entity = nextJson?.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error('Spotify entity data is empty or private.');
  }

  let coverUrl = pickEntityCover(entity);
  if (!coverUrl) {
    try {
      const oembed = (await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(
          `https://open.spotify.com/${parsed.kind}/${parsed.id}`
        )}`
      ).then((r) => r.json())) as { thumbnail_url?: string };
      if (oembed.thumbnail_url) {
        coverUrl = upgradeSpotifyCover(oembed.thumbnail_url);
      }
    } catch {
      // Optional oEmbed fallback
    }
  }

  const title = cleanText(entity.name || entity.title) || 'Spotify Collection';
  const releaseYear = entity.releaseDate?.isoString?.slice(0, 4);

  if (parsed.kind === 'track') {
    const artistNames =
      entity.artists
        ?.map((a) => cleanText(a.name))
        .filter(Boolean)
        .join(', ') ||
      cleanText(entity.subtitle) ||
      'Spotify Artist';

    const singleTrack = libraryStore.hydrateTrack({
      id: `sp_tr_${parsed.id}`,
      title,
      artist: artistNames,
      album: title,
      duration: Math.round((entity.duration ?? 0) / 1000),
      coverUrl,
      year: releaseYear,
      trackNumber: 1,
      sourceType: 'spotify',
    });

    return {
      title,
      artist: artistNames,
      coverUrl,
      sourceUrl: `https://open.spotify.com/track/${parsed.id}`,
      tracks: [singleTrack],
      provider: 'spotify',
    };
  }

  const artist =
    cleanText(entity.subtitle) ||
    entity.artists?.map((a) => cleanText(a.name)).filter(Boolean).join(', ') ||
    'Spotify';

  const rawList = entity.trackList ?? [];
  const tracks: Track[] = rawList.map((item, idx) => {
    const uriMatch = /spotify:track:([a-zA-Z0-9]+)/.exec(item.uri || '');
    const spTrackId = uriMatch ? uriMatch[1] : item.uid || `${parsed.id}_${idx + 1}`;
    return libraryStore.hydrateTrack({
      id: `sp_tr_${spTrackId}`,
      title: cleanText(item.title) || `Track ${idx + 1}`,
      artist: cleanText(item.subtitle) || artist,
      album: title,
      albumId: `sp_${parsed.kind}_${parsed.id}`,
      duration: Math.round((item.duration ?? 0) / 1000),
      coverUrl,
      trackNumber: idx + 1,
      year: releaseYear,
      sourceType: 'spotify',
    });
  });

  return {
    title,
    artist,
    coverUrl,
    sourceUrl: `https://open.spotify.com/${parsed.kind}/${parsed.id}`,
    tracks,
    provider: 'spotify',
  };
}
