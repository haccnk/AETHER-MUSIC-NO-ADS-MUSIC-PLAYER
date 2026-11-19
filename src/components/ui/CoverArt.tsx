import React, { useEffect, useMemo, useState } from 'react';
import { MusicNotes } from '@phosphor-icons/react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { cn } from '../../utils/format';

interface CoverArtProps {
  src?: string;
  title: string;
  artist?: string;
  className?: string;
  imgClassName?: string;
  iconSize?: number;
  loading?: 'lazy' | 'eager';
}

const FALLBACK_GRADIENTS = [
  'from-violet-600/50 via-indigo-700/45 to-slate-900',
  'from-cyan-500/45 via-sky-700/45 to-slate-900',
  'from-rose-500/45 via-fuchsia-700/45 to-slate-900',
  'from-amber-500/45 via-orange-700/45 to-slate-900',
  'from-emerald-500/45 via-teal-700/45 to-slate-900',
  'from-blue-500/45 via-purple-700/45 to-slate-900',
];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function buildCandidateUrls(src: string | undefined, mediaPort: number): string[] {
  const clean = (src || '').trim();
  if (!clean) return [];

  const list: string[] = [clean];

  // Apple Music CDN size downgrade fallback
  if (clean.includes('mzstatic.com') && clean.includes('1000x1000bb')) {
    list.push(clean.replace('1000x1000bb', '600x600bb'));
  }

  // YouTube thumbnail fallbacks
  const ytMatch = /i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\//.exec(clean);
  if (ytMatch) {
    const id = ytMatch[1];
    const hq = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const mq = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    if (!list.includes(hq)) list.push(hq);
    if (!list.includes(mq)) list.push(mq);
  }

  // Node local media server proxy fallback for external HTTPS URLs
  if (mediaPort > 0 && /^https?:\/\//i.test(clean) && !clean.startsWith('http://127.0.0.1:')) {
    list.push(`http://127.0.0.1:${mediaPort}/image?url=${encodeURIComponent(clean)}`);
  }

  return list;
}

export const CoverArt: React.FC<CoverArtProps> = ({
  src,
  title,
  artist = '',
  className,
  imgClassName,
  iconSize = 28,
  loading = 'lazy',
}) => {
  const mediaPort = usePlayerStore((s) => s.mediaPort);
  const candidates = useMemo(() => buildCandidateUrls(src, mediaPort), [src, mediaPort]);

  const [attemptIdx, setAttemptIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAttemptIdx(0);
    setLoaded(false);
  }, [src]);

  const activeUrl = attemptIdx < candidates.length ? candidates[attemptIdx] : '';
  const gradientClass = FALLBACK_GRADIENTS[hashSeed(`${title}:${artist}`) % FALLBACK_GRADIENTS.length];

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-gradient-to-br select-none',
        gradientClass,
        className
      )}
    >
      {/* Decorative generative vinyl groove behind image / fallback */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
        <div className="h-[74%] w-[74%] rounded-full border border-white/15 flex items-center justify-center">
          <div className="h-[52%] w-[52%] rounded-full border border-white/10" />
        </div>
      </div>

      {!activeUrl || !loaded ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/45">
          <MusicNotes size={iconSize} weight="light" />
        </div>
      ) : null}

      {activeUrl && (
        <img
          key={activeUrl}
          src={activeUrl}
          alt=""
          loading={loading}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setAttemptIdx((prev) => prev + 1);
          }}
          className={cn(
            'relative z-10 h-full w-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName
          )}
        />
      )}
    </div>
  );
};
