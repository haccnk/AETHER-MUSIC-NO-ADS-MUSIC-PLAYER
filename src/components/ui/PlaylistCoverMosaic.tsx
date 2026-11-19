import React from 'react';
import { Heart, MusicNotes } from '@phosphor-icons/react';
import { Track } from '../../types/music';
import { CoverArt } from './CoverArt';
import { cn } from '../../utils/format';

interface PlaylistCoverMosaicProps {
  variant?: 'liked' | 'playlist';
  title: string;
  coverUrl?: string;
  tracks?: Track[];
  className?: string;
  iconSize?: number;
}

export const PlaylistCoverMosaic: React.FC<PlaylistCoverMosaicProps> = ({
  variant = 'playlist',
  title,
  coverUrl,
  tracks = [],
  className,
  iconSize = 26,
}) => {
  if (variant === 'liked') {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 shadow-inner',
          className
        )}
      >
        <div className="pointer-events-none absolute -top-1/3 -right-1/3 h-full w-full rounded-full bg-white/15 blur-xl" />
        <Heart size={iconSize} weight="fill" className="relative z-10 text-white drop-shadow" />
      </div>
    );
  }

  const distinctCovers: string[] = [];
  for (const tr of tracks) {
    if (tr.coverUrl && !distinctCovers.includes(tr.coverUrl)) {
      distinctCovers.push(tr.coverUrl);
      if (distinctCovers.length === 4) break;
    }
  }

  if (distinctCovers.length === 4) {
    return (
      <div className={cn('grid grid-cols-2 grid-rows-2 overflow-hidden bg-black/40', className)}>
        {distinctCovers.map((url, idx) => (
          <CoverArt
            key={`${url}_${idx}`}
            src={url}
            title={title}
            className="h-full w-full"
            iconSize={Math.max(10, Math.round(iconSize * 0.45))}
          />
        ))}
      </div>
    );
  }

  const singleUrl = coverUrl || distinctCovers[0];
  if (singleUrl) {
    return (
      <CoverArt
        src={singleUrl}
        title={title}
        className={className}
        iconSize={iconSize}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.03] text-white/50',
        className
      )}
    >
      <MusicNotes size={iconSize} weight="light" />
    </div>
  );
};
