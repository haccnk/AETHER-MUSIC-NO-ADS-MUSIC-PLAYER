import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import type { IAudioMetadata, IOptions } from 'music-metadata';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseFile } = require('music-metadata') as {
  parseFile: (filePath: string, options?: IOptions) => Promise<IAudioMetadata>;
};

interface RegisteredStream {
  url: string;
  headers: Record<string, string>;
  expiresAt: number;
}

const MIME_MAP: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
};

class LocalMediaServer {
  private server: http.Server | null = null;
  private port = 0;
  private remoteStreams = new Map<string, RegisteredStream>();
  private coverCache = new Map<string, { mime: string; data: Buffer }>();
  private remoteImageCache = new Map<string, { mime: string; data: Buffer }>();

  public async start(): Promise<number> {
    if (this.server && this.port > 0) return this.port;

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        resolve();
      });
    });

    return this.port;
  }

  public getPort(): number {
    return this.port;
  }

  public getLocalAudioUrl(filePath: string): string {
    return `http://127.0.0.1:${this.port}/local?path=${encodeURIComponent(filePath)}`;
  }

  public getLocalCoverUrl(filePath: string): string {
    return `http://127.0.0.1:${this.port}/cover?path=${encodeURIComponent(filePath)}`;
  }

  public registerRemoteStream(
    token: string,
    url: string,
    headers: Record<string, string>,
    ttlMs = 25 * 60 * 1000
  ): string {
    this.remoteStreams.set(token, {
      url,
      headers,
      expiresAt: Date.now() + ttlMs,
    });
    return `http://127.0.0.1:${this.port}/stream?token=${encodeURIComponent(token)}`;
  }

  private setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range, Accept-Ranges, Content-Type'
    );
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const parsed = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);

      if (parsed.pathname === '/local') {
        const filePath = parsed.searchParams.get('path') || '';
        this.serveLocalFile(filePath, req, res);
        return;
      }

      if (parsed.pathname === '/cover') {
        const filePath = parsed.searchParams.get('path') || '';
        await this.serveCoverArt(filePath, res);
        return;
      }

      if (parsed.pathname === '/image') {
        const imgUrl = parsed.searchParams.get('url') || '';
        await this.serveProxiedImage(imgUrl, res);
        return;
      }

      if (parsed.pathname === '/stream') {
        const token = parsed.searchParams.get('token') || '';
        this.proxyRemoteStream(token, req, res);
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    } catch {
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end();
    }
  }

  private serveLocalFile(
    filePath: string,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    const stat = fs.statSync(filePath);
    const total = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'audio/mpeg';
    const range = req.headers.range;

    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
        if (start >= total || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${total}` });
          res.end();
          return;
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': total,
      'Content-Type': contentType,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  }

  private async serveCoverArt(filePath: string, res: http.ServerResponse): Promise<void> {
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end();
      return;
    }

    const cached = this.coverCache.get(filePath);
    if (cached) {
      res.writeHead(200, {
        'Content-Type': cached.mime,
        'Content-Length': cached.data.length,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(cached.data);
      return;
    }

    try {
      const metadata = await parseFile(filePath, { skipPostHeaders: true });
      const pic = metadata.common.picture?.[0];
      if (!pic) {
        res.writeHead(404);
        res.end();
        return;
      }
      const buf = Buffer.from(pic.data);
      const mime = pic.format || 'image/jpeg';
      if (this.coverCache.size > 300) {
        const firstKey = this.coverCache.keys().next().value;
        if (firstKey) this.coverCache.delete(firstKey);
      }
      this.coverCache.set(filePath, { mime, data: buf });
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': buf.length,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end();
    }
  }

  private async serveProxiedImage(imgUrl: string, res: http.ServerResponse): Promise<void> {
    if (!imgUrl || !/^https?:\/\//i.test(imgUrl)) {
      res.writeHead(400);
      res.end();
      return;
    }

    const cached = this.remoteImageCache.get(imgUrl);
    if (cached) {
      res.writeHead(200, {
        'Content-Type': cached.mime,
        'Content-Length': cached.data.length,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(cached.data);
      return;
    }

    try {
      const upstream = await fetch(imgUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!upstream.ok) {
        res.writeHead(upstream.status);
        res.end();
        return;
      }
      const mime = upstream.headers.get('content-type') || 'image/jpeg';
      const data = Buffer.from(await upstream.arrayBuffer());
      if (this.remoteImageCache.size > 150) {
        const firstKey = this.remoteImageCache.keys().next().value;
        if (firstKey) this.remoteImageCache.delete(firstKey);
      }
      this.remoteImageCache.set(imgUrl, { mime, data });
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(data);
    } catch {
      res.writeHead(502);
      res.end();
    }
  }

  private proxyRemoteStream(
    token: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    redirectsLeft = 3
  ): void {
    const entry = this.remoteStreams.get(token);
    if (!entry || Date.now() > entry.expiresAt) {
      res.writeHead(404);
      res.end('Stream expired or not found');
      return;
    }

    this.forwardUpstream(entry.url, entry.headers, req, res, redirectsLeft);
  }

  private forwardUpstream(
    targetUrl: string,
    baseHeaders: Record<string, string>,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    redirectsLeft: number
  ): void {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const outHeaders: Record<string, string> = {
      'User-Agent':
        baseHeaders['User-Agent'] ||
        baseHeaders['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    const forwardKeys = ['Referer', 'Origin', 'Cookie', 'Accept', 'Accept-Language'];
    for (const key of forwardKeys) {
      const val = baseHeaders[key] ?? baseHeaders[key.toLowerCase()];
      if (val) outHeaders[key] = val;
    }
    if (req.headers.range) outHeaders['Range'] = req.headers.range;

    const upstreamReq = transport.request(
      parsedUrl,
      {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: outHeaders,
      },
      (upstreamRes) => {
        const status = upstreamRes.statusCode || 200;
        if (
          (status === 301 || status === 302 || status === 307 || status === 308) &&
          upstreamRes.headers.location &&
          redirectsLeft > 0
        ) {
          upstreamRes.resume();
          const nextUrl = new URL(upstreamRes.headers.location, targetUrl).toString();
          this.forwardUpstream(nextUrl, baseHeaders, req, res, redirectsLeft - 1);
          return;
        }

        const replyHeaders: Record<string, string | string[]> = {
          'Access-Control-Allow-Origin': '*',
          'Accept-Ranges': upstreamRes.headers['accept-ranges'] || 'bytes',
          'Content-Type': upstreamRes.headers['content-type'] || 'audio/mp4',
        };
        if (upstreamRes.headers['content-length']) {
          replyHeaders['Content-Length'] = upstreamRes.headers['content-length'];
        }
        if (upstreamRes.headers['content-range']) {
          replyHeaders['Content-Range'] = upstreamRes.headers['content-range'];
        }

        res.writeHead(status, replyHeaders);
        upstreamRes.pipe(res);
      }
    );

    upstreamReq.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end();
    });

    req.on('close', () => {
      upstreamReq.destroy();
    });

    upstreamReq.end();
  }

  public stop(): void {
    if (!this.server) return;
    try {
      this.server.closeAllConnections?.();
      this.server.close();
    } catch {
      // Ignore shutdown errors
    }
    this.server = null;
  }
}

export const mediaServer = new LocalMediaServer();
