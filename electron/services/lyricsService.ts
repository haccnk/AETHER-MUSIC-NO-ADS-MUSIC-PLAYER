import fs from 'fs';
import { LyricCandidate, LyricLine, LyricsPayload, Track } from '../../src/types/music';
import { extractArtistTokens, hasCjk, hasTokenMatch, normalizeCmp } from './streamService';

interface LrcLibItem {
  id: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

const lyricsCache = new Map<string, LyricsPayload>();

export function parseLrcContent(raw: string, totalDurationSec = 0): LyricLine[] {
  const rows: { timeMs: number; text: string }[] = [];
  const lines = raw.split(/\r?\n/);

  // Support standard LRC [offset:+/-ms] header tag: positive delays lyrics, negative advances them
  const offsetMatch = /\[offset:\s*([+-]?\d+)\s*\]/i.exec(raw);
  const fileOffsetMs = offsetMatch ? Number(offsetMatch[1]) : 0;

  const tagRegex = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lines) {
    const matches = [...line.matchAll(tagRegex)];
    if (matches.length === 0) continue;

    const text = line.replace(tagRegex, '').trim();
    for (const m of matches) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const fracRaw = m[3] ?? '0';
      const ms = fracRaw.length === 3 ? Number(fracRaw) : Number(fracRaw.padEnd(2, '0')) * 10;
      const timeMs = Math.max(0, min * 60_000 + sec * 1_000 + ms + fileOffsetMs);
      rows.push({ timeMs, text: text || '♪' });
    }
  }

  rows.sort((a, b) => a.timeMs - b.timeMs);

  const result: LyricLine[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    const next = rows[i + 1];
    const fallbackEnd =
      totalDurationSec > 0
        ? Math.max(cur.timeMs + 4000, totalDurationSec * 1000)
        : cur.timeMs + 5000;
    const endTimeMs = next ? Math.max(cur.timeMs + 300, next.timeMs) : fallbackEnd;
    result.push({
      timeMs: cur.timeMs,
      endTimeMs,
      text: cur.text,
    });
  }

  return result;
}

function cleanQueryTitle(title: string): string {
  return title
    .replace(/\(feat\..*?\)|\[feat\..*?\]|\(ft\..*?\)/gi, '')
    .replace(/\(Official.*?\)|\[Official.*?\]/gi, '')
    .replace(/\(Lyrics.*?\)|\[Lyrics.*?\]/gi, '')
    .replace(/\(Audio.*?\)|\[Audio.*?\]/gi, '')
    .replace(/\(Music Video\)|\[MV\]|MV$/gi, '')
    .trim();
}

function cleanArtistName(artist: string): string {
  return artist.split(',')[0].split('&')[0].split('feat.')[0].trim();
}

function formatSecLabel(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function scoreLrcRecord(item: LrcLibItem, track: Track, targetDur: number): number {
  const artistTokens = extractArtistTokens(track);
  const gotArtistNorm = normalizeCmp(item.artistName || '');
  const gotTrackNorm = normalizeCmp(cleanQueryTitle(item.trackName || ''));
  const artistMatched =
    artistTokens.length === 0 ||
    /^(unknown|youtube)/i.test(track.artist) ||
    hasTokenMatch(artistTokens, gotArtistNorm) ||
    hasTokenMatch(artistTokens, gotTrackNorm);

  if (!artistMatched) {
    return -9999;
  }

  let score = 70;
  let durDiff = 0;
  if (targetDur > 20 && item.duration && item.duration > 0) {
    durDiff = Math.abs(item.duration - targetDur);
    if (durDiff > 10) {
      // Prevent MV-cut LRCs with 12-45s acting intros from matching studio audio
      return -9999;
    }
    if (durDiff <= 1.5) score += 160;
    else if (durDiff <= 3.5) score += 120;
    else if (durDiff <= 6) score += 65;
    else score += 20;
  }

  const cleanTitle = cleanQueryTitle(track.title);
  const wantTitle = normalizeCmp(cleanTitle);
  const itemCleanTitle = cleanQueryTitle(item.trackName || '');
  const gotTitle = normalizeCmp(itemCleanTitle);

  if (wantTitle.length > 0 && gotTitle.length > 0) {
    if (gotTitle === wantTitle) {
      score += 80;
    } else if (
      wantTitle.length >= 2 &&
      gotTitle.length >= 2 &&
      (gotTitle.includes(wantTitle) || wantTitle.includes(gotTitle))
    ) {
      score += 40;
    } else if (hasCjk(cleanTitle) !== hasCjk(itemCleanTitle) && durDiff <= 4) {
      // Official Japanese/English title alias for the exact same artist & duration
      score += 45;
    } else {
      return -9999;
    }
  } else {
    return -9999;
  }

  const gotLower = (item.trackName || '').toLowerCase();
  const wantLower = track.title.toLowerCase();
  if (
    (gotLower.includes('english') || gotLower.includes('romanized') || gotLower.includes('romaji')) &&
    !wantLower.includes('english')
  ) {
    score -= 90;
  }

  return score;
}

async function fetchLrcLibCandidates(
  track: Track,
  targetDurationSec: number
): Promise<LrcLibItem[]> {
  const title = cleanQueryTitle(track.title);
  const artist = cleanArtistName(track.artist);
  const collected: LrcLibItem[] = [];
  const seenIds = new Set<number>();

  const pushUnique = (item: LrcLibItem | null | undefined) => {
    if (!item || !item.id || seenIds.has(item.id)) return;
    if (!item.syncedLyrics && !item.plainLyrics) return;
    seenIds.add(item.id);
    collected.push(item);
  };

  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });
    if (track.album && track.album !== 'Singles') {
      params.set('album_name', track.album);
    }
    if (targetDurationSec > 10) {
      params.set('duration', String(Math.round(targetDurationSec)));
    }
    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'AetherMusic/1.0 (https://github.com/aether-music)' },
    });
    if (res.ok) {
      pushUnique((await res.json()) as LrcLibItem);
    }
  } catch {
    // Continue to search
  }

  try {
    const q = `${artist} ${title}`.trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'AetherMusic/1.0 (https://github.com/aether-music)' },
    });
    if (res.ok) {
      const list = (await res.json()) as LrcLibItem[];
      if (Array.isArray(list)) {
        for (const item of list) pushUnique(item);
      }
    }
  } catch {
    // Ignore
  }

  if (collected.length === 0 && title && artist) {
    try {
      const res = await fetch(
        `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
        {
          headers: { 'User-Agent': 'AetherMusic/1.0 (https://github.com/aether-music)' },
        }
      );
      if (res.ok) {
        const list = (await res.json()) as LrcLibItem[];
        if (Array.isArray(list)) {
          for (const item of list) pushUnique(item);
        }
      }
    } catch {
      // Ignore
    }
  }

  return collected;
}

function isLocalLrcCompatible(raw: string, lines: LyricLine[], track: Track, targetDur: number): boolean {
  const arMatch = /\[ar:\s*([^\]]+)\]/i.exec(raw);
  if (arMatch?.[1] && track.artist && !/^(unknown|youtube)/i.test(track.artist)) {
    const tokens = extractArtistTokens(track);
    if (tokens.length > 0 && !hasTokenMatch(tokens, normalizeCmp(arMatch[1]))) {
      return false;
    }
  }
  const lastSec = (lines[lines.length - 1]?.timeMs ?? 0) / 1000;
  if (targetDur > 25 && lastSec > targetDur + 12) {
    return false;
  }
  return true;
}

export async function getLyrics(
  track: Track,
  actualDurationSec?: number
): Promise<LyricsPayload> {
  const targetDur =
    actualDurationSec && actualDurationSec > 10 ? actualDurationSec : track.duration;

  const possibleLrcPaths: string[] = [];
  if (track.lrcPath) possibleLrcPaths.push(track.lrcPath);
  if (track.localPath) {
    possibleLrcPaths.push(track.localPath.replace(/\.[^/.]+$/, '.lrc'));
  }

  for (const lrcFile of possibleLrcPaths) {
    if (lrcFile && fs.existsSync(lrcFile)) {
      try {
        const raw = fs.readFileSync(lrcFile, 'utf8');
        const lines = parseLrcContent(raw, targetDur);
        if (lines.length > 0 && isLocalLrcCompatible(raw, lines, track, targetDur)) {
          return {
            trackId: track.id,
            synced: true,
            lines,
            plainText: lines.map((l) => l.text).join('\n'),
            source: 'local',
          };
        }
      } catch {
        // Continue to remote
      }
    }
  }

  const cacheKey = `${track.id}::${Math.round(targetDur || 0)}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  const records = await fetchLrcLibCandidates(track, targetDur);
  if (records.length === 0) {
    return {
      trackId: track.id,
      synced: false,
      lines: [],
      source: 'none',
    };
  }

  const syncedRecords = records
    .filter((r) => Boolean(r.syncedLyrics) && scoreLrcRecord(r, track, targetDur) >= 90)
    .sort(
      (a, b) => scoreLrcRecord(b, track, targetDur) - scoreLrcRecord(a, track, targetDur)
    );

  const candidates: LyricCandidate[] = [];
  for (const item of syncedRecords.slice(0, 5)) {
    if (!item.syncedLyrics) continue;
    const parsedLines = parseLrcContent(item.syncedLyrics, targetDur);
    if (parsedLines.length === 0) continue;
    const durTag = formatSecLabel(item.duration);
    candidates.push({
      id: item.id,
      label: `${item.trackName || track.title} — ${item.artistName || track.artist}${durTag ? ` (${durTag})` : ''}`,
      duration: item.duration ?? targetDur,
      lines: parsedLines,
    });
  }

  if (candidates.length > 0) {
    const best = candidates[0];
    const payload: LyricsPayload = {
      trackId: track.id,
      synced: true,
      lines: best.lines,
      plainText: best.lines.map((l) => l.text).join('\n'),
      source: 'lrclib',
      candidates,
      selectedCandidateId: best.id,
    };
    lyricsCache.set(cacheKey, payload);
    return payload;
  }

  const plainCandidates = records
    .filter((r) => Boolean(r.plainLyrics) && scoreLrcRecord(r, track, targetDur) >= 90)
    .sort(
      (a, b) => scoreLrcRecord(b, track, targetDur) - scoreLrcRecord(a, track, targetDur)
    );
  const plainRec = plainCandidates[0];
  const payload: LyricsPayload = {
    trackId: track.id,
    synced: false,
    lines: [],
    plainText: plainRec?.plainLyrics ?? undefined,
    source: plainRec ? 'lrclib' : 'none',
  };
  lyricsCache.set(cacheKey, payload);
  return payload;
}

export async function fetchRawLyricsForDownload(
  track: Track,
  actualDurationSec?: number
): Promise<{ syncedLrc?: string; plainLyrics?: string }> {
  const targetDur =
    actualDurationSec && actualDurationSec > 10 ? actualDurationSec : track.duration;
  const records = await fetchLrcLibCandidates(track, targetDur);
  if (records.length === 0) return {};

  const synced = records
    .filter((r) => Boolean(r.syncedLyrics) && scoreLrcRecord(r, track, targetDur) >= 90)
    .sort(
      (a, b) => scoreLrcRecord(b, track, targetDur) - scoreLrcRecord(a, track, targetDur)
    );

  const bestSynced = synced[0];
  const plainMatch = records
    .filter((r) => Boolean(r.plainLyrics) && scoreLrcRecord(r, track, targetDur) >= 90)
    .sort(
      (a, b) => scoreLrcRecord(b, track, targetDur) - scoreLrcRecord(a, track, targetDur)
    )[0];
  const bestPlain = bestSynced ?? plainMatch;
  return {
    syncedLrc: bestSynced?.syncedLyrics ?? undefined,
    plainLyrics: bestPlain?.plainLyrics ?? undefined,
  };
}
