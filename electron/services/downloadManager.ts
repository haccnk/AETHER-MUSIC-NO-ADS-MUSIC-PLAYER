import path from 'path';
import fs from 'fs';
import NodeID3 from 'node-id3';
import { DownloadTask, Track } from '../../src/types/music';
import { execYtDlp, getFfmpegPath } from './binaryManager';
import { fetchRawLyricsForDownload } from './lyricsService';
import { resolveBestYoutubeAudio } from './streamService';
import { libraryStore } from './store';

type UpdateListener = (tasks: DownloadTask[], libraryChanged?: boolean) => void;

function sanitizeSegment(name: string, fallback = 'Unknown'): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned.slice(0, 90) || fallback;
}

class DownloadManager {
  private tasks: DownloadTask[] = [];
  private controllers = new Map<string, AbortController>();
  private coverBufferCache = new Map<string, Buffer>();
  private activeCount = 0;
  private shuttingDown = false;
  private listeners = new Set<UpdateListener>();

  public shutdown(): void {
    this.shuttingDown = true;
    for (const ctrl of this.controllers.values()) {
      try {
        ctrl.abort();
      } catch {
        // Ignore abort error during shutdown
      }
    }
    this.controllers.clear();
  }

  public subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(libraryChanged = false): void {
    const snapshot = this.getTasks();
    for (const listener of this.listeners) {
      listener(snapshot, libraryChanged);
    }
  }

  public getTasks(): DownloadTask[] {
    return this.tasks.map((t) => ({ ...t }));
  }

  public enqueueTracks(tracks: Track[], albumTitle?: string): DownloadTask[] {
    const batchId = tracks.length > 1 ? `batch_${Date.now()}` : undefined;
    const created: DownloadTask[] = [];

    for (const rawTrack of tracks) {
      const track = libraryStore.hydrateTrack(rawTrack);
      // Skip if actively queued or downloading the same track
      const existingActive = this.tasks.find(
        (t) =>
          t.track.id === track.id &&
          (t.status === 'queued' ||
            t.status === 'resolving' ||
            t.status === 'downloading' ||
            t.status === 'tagging')
      );
      if (existingActive) continue;

      const task: DownloadTask = {
        id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        track,
        albumBatchId: batchId,
        albumTitle: albumTitle || track.album,
        status: 'queued',
        progress: 0,
        createdAt: Date.now(),
      };
      this.tasks.unshift(task);
      created.push(task);
    }

    this.emit();
    this.pumpQueue();
    return this.getTasks();
  }

  public cancelTask(taskId: string): DownloadTask[] {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return this.getTasks();

    const ctrl = this.controllers.get(taskId);
    if (ctrl) {
      ctrl.abort();
      this.controllers.delete(taskId);
    }

    if (task.status !== 'completed') {
      task.status = 'cancelled';
      task.speed = undefined;
    }
    this.emit();
    return this.getTasks();
  }

  public retryTask(taskId: string): DownloadTask[] {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task && (task.status === 'failed' || task.status === 'cancelled')) {
      task.status = 'queued';
      task.progress = 0;
      task.error = undefined;
      task.speed = undefined;
      this.emit();
      this.pumpQueue();
    }
    return this.getTasks();
  }

  public clearCompleted(): DownloadTask[] {
    this.tasks = this.tasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed'
    );
    this.emit();
    return this.getTasks();
  }

  private pumpQueue(): void {
    if (this.shuttingDown) return;
    const maxWorkers = Math.max(1, Math.min(5, libraryStore.getSettings().maxConcurrentDownloads || 3));
    while (this.activeCount < maxWorkers) {
      // Process oldest queued task first so albums download 01 -> 02 -> 03 cleanly
      const next = [...this.tasks].reverse().find((t) => t.status === 'queued');
      if (!next) break;
      void this.runTask(next);
    }
  }

  private async fetchCoverBuffer(url: string): Promise<Buffer | undefined> {
    if (!url || !/^https?:\/\//i.test(url)) return undefined;
    const cached = this.coverBufferCache.get(url);
    if (cached) return cached;

    try {
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const buf = Buffer.from(await res.arrayBuffer());
      if (this.coverBufferCache.size > 40) {
        const first = this.coverBufferCache.keys().next().value;
        if (first) this.coverBufferCache.delete(first);
      }
      this.coverBufferCache.set(url, buf);
      return buf;
    } catch {
      return undefined;
    }
  }

  private async runTask(task: DownloadTask): Promise<void> {
    this.activeCount++;
    const workerIndex = this.activeCount;
    const controller = new AbortController();
    this.controllers.set(task.id, controller);

    try {
      if (workerIndex > 1) {
        await new Promise((resolve) => setTimeout(resolve, (workerIndex - 1) * 500));
      }
      if (controller.signal.aborted) throw new Error('ABORTED');

      const settings = libraryStore.getSettings();
      const baseDir = settings.downloadDir;
      const artistFolder = sanitizeSegment(task.track.artist.split(',')[0].trim(), 'Unknown Artist');
      const albumFolder = sanitizeSegment(task.track.album || 'Singles', 'Singles');
      const targetDir = path.join(baseDir, artistFolder, albumFolder);
      fs.mkdirSync(targetDir, { recursive: true });

      const trackPrefix =
        task.track.trackNumber && task.track.trackNumber > 0
          ? `${String(task.track.trackNumber).padStart(2, '0')} - `
          : '';
      const baseFilename = `${trackPrefix}${sanitizeSegment(task.track.title, 'Track')}`;
      const outputBase = path.join(targetDir, baseFilename);
      const finalMp3Path = `${outputBase}.mp3`;
      const finalLrcPath = `${outputBase}.lrc`;

      task.status = 'resolving';
      task.progress = 2;
      this.emit();

      let targetUrl = task.track.sourceUrl;
      let resolvedYtId = task.track.youtubeId;
      let matchedDuration = task.track.duration;
      if (
        !targetUrl ||
        targetUrl.includes('itunes.apple.com') ||
        targetUrl.includes('open.spotify.com')
      ) {
        const matched = await resolveBestYoutubeAudio(task.track);
        resolvedYtId = matched.youtubeId;
        matchedDuration = matched.matchedDuration || task.track.duration;
        targetUrl = `https://www.youtube.com/watch?v=${resolvedYtId}`;
      }

      if (controller.signal.aborted) throw new Error('ABORTED');

      task.status = 'downloading';
      task.progress = 5;
      this.emit();

      const ffmpegPath = getFfmpegPath();

      await execYtDlp(
        [
          targetUrl,
          '-f',
          'bestaudio[format_note*=original]/bestaudio[format_note!*=dubbed]/bestaudio',
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '0',
          '--postprocessor-args',
          'ffmpeg:-b:a 320k',
          '--ffmpeg-location',
          ffmpegPath,
          '--newline',
          '--no-playlist',
          '--no-warnings',
          '-o',
          `${outputBase}.%(ext)s`,
        ],
        {
          signal: controller.signal,
          onLine: (line) => {
            const pctMatch = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
            if (pctMatch) {
              const pct = parseFloat(pctMatch[1]);
              task.progress = Math.min(88, Math.max(5, Math.round(5 + pct * 0.83)));
              const spdMatch = /at\s+([^\s]+\/s)/.exec(line);
              if (spdMatch) task.speed = spdMatch[1];
              this.emit();
            } else if (line.includes('[ExtractAudio]') || line.includes('Post-process')) {
              task.status = 'tagging';
              task.progress = 92;
              task.speed = undefined;
              this.emit();
            }
          },
        }
      );

      if (!fs.existsSync(finalMp3Path)) {
        throw new Error('Converted MP3 output file was not produced.');
      }

      task.status = 'tagging';
      task.progress = 95;
      task.speed = undefined;
      this.emit();

      // Fetch cover art & synced lyrics in parallel
      const [coverBuffer, lyricsData] = await Promise.all([
        this.fetchCoverBuffer(task.track.coverUrl),
        fetchRawLyricsForDownload(task.track, matchedDuration),
      ]);

      let savedLrcPath: string | undefined;
      if (lyricsData.syncedLrc) {
        const lrcToWrite = /\[ar:/i.test(lyricsData.syncedLrc)
          ? lyricsData.syncedLrc
          : `[ti:${task.track.title}]\n[ar:${task.track.artist}]\n[length:${matchedDuration}]\n${lyricsData.syncedLrc}`;
        fs.writeFileSync(finalLrcPath, lrcToWrite, 'utf8');
        savedLrcPath = finalLrcPath;
      }

      const id3Tags: NodeID3.Tags = {
        title: task.track.title,
        artist: task.track.artist,
        album: task.track.album || 'Singles',
        trackNumber: task.track.trackNumber ? String(task.track.trackNumber) : undefined,
        year: task.track.year,
        unsynchronisedLyrics: lyricsData.plainLyrics
          ? { language: 'eng', text: lyricsData.plainLyrics }
          : undefined,
        image: coverBuffer
          ? {
              mime: 'image/jpeg',
              type: { id: 3, name: 'front cover' },
              description: 'Album Cover',
              imageBuffer: coverBuffer,
            }
          : undefined,
      };

      NodeID3.update(id3Tags, finalMp3Path);

      const completedTrack: Track = {
        ...task.track,
        youtubeId: resolvedYtId,
        localPath: finalMp3Path,
        lrcPath: savedLrcPath,
        bitrate: 320,
        addedAt: Date.now(),
      };
      libraryStore.addDownloadedTrack(completedTrack);

      task.track = completedTrack;
      task.status = 'completed';
      task.progress = 100;
      task.outputPath = finalMp3Path;
      this.emit(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'ABORTED' || controller.signal.aborted) {
        task.status = 'cancelled';
      } else {
        task.status = 'failed';
        task.error = msg;
      }
      task.speed = undefined;
      this.emit();
    } finally {
      this.controllers.delete(task.id);
      this.activeCount = Math.max(0, this.activeCount - 1);
      this.pumpQueue();
    }
  }
}

export const downloadManager = new DownloadManager();
