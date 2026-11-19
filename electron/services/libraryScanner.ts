import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { IAudioMetadata, IOptions } from 'music-metadata';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseFile } = require('music-metadata') as {
  parseFile: (filePath: string, options?: IOptions) => Promise<IAudioMetadata>;
};
import { Track } from '../../src/types/music';
import { mediaServer } from './mediaServer';
import { libraryStore } from './store';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.opus', '.aac']);

function collectAudioFiles(dirPath: string, out: string[], depth = 0): void {
  if (depth > 8 || !fs.existsSync(dirPath)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectAudioFiles(full, out, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        out.push(full);
      }
    }
  }
}

export async function scanFolders(folders: string[]): Promise<Track[]> {
  const uniqueFolders = [...new Set(folders.filter((f) => f && fs.existsSync(f)))];
  const filePaths: string[] = [];

  for (const folder of uniqueFolders) {
    collectAudioFiles(folder, filePaths);
  }

  const uniqueFiles = [...new Set(filePaths)];
  const scanned: Track[] = [];

  for (const filePath of uniqueFiles) {
    try {
      const meta = await parseFile(filePath, { skipPostHeaders: true });
      const fileName = path.basename(filePath, path.extname(filePath));
      const parentAlbum = path.basename(path.dirname(filePath));

      const hasPicture = Boolean(meta.common.picture && meta.common.picture.length > 0);
      const lrcCandidate = filePath.replace(/\.[^/.]+$/, '.lrc');
      const hasLrc = fs.existsSync(lrcCandidate);

      const idHash = crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 16);

      scanned.push({
        id: `local_${idHash}`,
        title: meta.common.title || fileName,
        artist: meta.common.artist || meta.common.albumartist || 'Unknown Artist',
        album: meta.common.album || parentAlbum || 'Local Music',
        duration: Math.round(meta.format.duration ?? 0),
        coverUrl: hasPicture ? mediaServer.getLocalCoverUrl(filePath) : '',
        trackNumber: meta.common.track?.no ?? undefined,
        year: meta.common.year ? String(meta.common.year) : undefined,
        localPath: filePath,
        lrcPath: hasLrc ? lrcCandidate : undefined,
        sourceType: 'local',
        bitrate: meta.format.bitrate ? Math.round(meta.format.bitrate / 1000) : undefined,
        addedAt: Date.now(),
      });
    } catch {
      // Skip unreadable file
    }
  }

  libraryStore.setLocalTracks(scanned, uniqueFolders);
  return scanned;
}
