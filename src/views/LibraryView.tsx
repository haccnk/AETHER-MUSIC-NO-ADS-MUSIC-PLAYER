import React, { useMemo, useState } from 'react';
import {
  ArrowClockwise,
  ArrowLeft,
  FolderOpen,
  FolderPlus,
  MagnifyingGlass,
  MusicNotes,
  Play,
  SpinnerGap,
} from '@phosphor-icons/react';
import { Track } from '../types/music';
import { usePlayerStore } from '../store/usePlayerStore';
import { TrackRow } from '../components/cards/TrackRow';
import { CoverArt } from '../components/ui/CoverArt';
import { cn } from '../utils/format';

interface OfflineAlbumGroup {
  key: string;
  title: string;
  artist: string;
  coverUrl: string;
  tracks: Track[];
}

export const LibraryView: React.FC = () => {
  const downloadedMap = usePlayerStore((s) => s.downloadedTracks);
  const localTracks = usePlayerStore((s) => s.localTracks);
  const settings = usePlayerStore((s) => s.settings);
  const addLocalFolder = usePlayerStore((s) => s.addLocalFolder);
  const rescanLocalFolders = usePlayerStore((s) => s.rescanLocalFolders);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const t = usePlayerStore((s) => s.t());

  const [tab, setTab] = useState<'downloaded' | 'local' | 'albums'>('downloaded');
  const [filter, setFilter] = useState('');
  const [scanning, setScanning] = useState(false);
  const [openedAlbumKey, setOpenedAlbumKey] = useState<string | null>(null);

  const downloadedList = useMemo(
    () =>
      Object.values(downloadedMap).sort(
        (a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)
      ),
    [downloadedMap]
  );

  const allOfflineTracks = useMemo(
    () => [...downloadedList, ...localTracks],
    [downloadedList, localTracks]
  );

  const albumGroups = useMemo(() => {
    const map = new Map<string, OfflineAlbumGroup>();
    for (const tr of allOfflineTracks) {
      const key = `${tr.artist}::${tr.album || 'Singles'}`;
      const existing = map.get(key);
      if (existing) {
        existing.tracks.push(tr);
        if (!existing.coverUrl && tr.coverUrl) existing.coverUrl = tr.coverUrl;
      } else {
        map.set(key, {
          key,
          title: tr.album || 'Singles',
          artist: tr.artist,
          coverUrl: tr.coverUrl,
          tracks: [tr],
        });
      }
    }
    for (const grp of map.values()) {
      grp.tracks.sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999));
    }
    return [...map.values()];
  }, [allOfflineTracks]);

  const filterTracks = (list: Track[]) => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (tr) =>
        tr.title.toLowerCase().includes(q) ||
        tr.artist.toLowerCase().includes(q) ||
        tr.album.toLowerCase().includes(q)
    );
  };

  const handleScanFolder = async () => {
    setScanning(true);
    try {
      await addLocalFolder();
      setTab('local');
    } finally {
      setScanning(false);
    }
  };

  const handleRescan = async () => {
    setScanning(true);
    try {
      await rescanLocalFolders();
    } finally {
      setScanning(false);
    }
  };

  const selectedGroup = openedAlbumKey
    ? albumGroups.find((g) => g.key === openedAlbumKey) ?? null
    : null;

  return (
    <div className="space-y-6 pb-36">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-white">
            {t.library.title}
          </h1>
          <p className="mt-1 text-[13.5px] text-white/55">{t.library.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void window.aetherAPI?.openFolder(settings.downloadDir)}
            className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-[12.5px] font-semibold text-white/85 hover:bg-white/12"
          >
            <FolderOpen size={15} />
            {t.library.openFolder}
          </button>

          <button
            type="button"
            disabled={scanning}
            onClick={() => void handleScanFolder()}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-black shadow transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {scanning ? (
              <SpinnerGap size={15} className="animate-spin" />
            ) : (
              <FolderPlus size={15} weight="bold" />
            )}
            {scanning ? t.library.scanning : t.library.scanFolderBtn}
          </button>

          {settings.localFolders.length > 0 && (
            <button
              type="button"
              disabled={scanning}
              onClick={() => void handleRescan()}
              title={t.library.rescanBtn}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-white/75 hover:bg-white/12 hover:text-white"
            >
              <ArrowClockwise size={15} className={scanning ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] p-1 w-max">
          {(
            [
              { id: 'downloaded', label: `${t.library.tabDownloaded} (${downloadedList.length})` },
              { id: 'local', label: `${t.library.tabLocal} (${localTracks.length})` },
              { id: 'albums', label: `${t.library.tabAlbums} (${albumGroups.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setOpenedAlbumKey(null);
              }}
              className={cn(
                'rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all',
                tab === item.id
                  ? 'bg-white text-black shadow'
                  : 'text-white/65 hover:text-white'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 sm:w-64">
          <MagnifyingGlass size={14} className="text-white/45" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t.library.filterPlaceholder}
            className="w-full bg-transparent text-[13px] text-white placeholder-white/40 outline-none"
          />
        </div>
      </div>

      {/* Content */}
      {tab === 'albums' ? (
        selectedGroup ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setOpenedAlbumKey(null)}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-1.5 text-[12.5px] font-medium text-white/80 hover:bg-white/10"
            >
              <ArrowLeft size={14} />
              {t.album.back}
            </button>
            <div className="bezel-outer">
              <div className="bezel-inner p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                      <CoverArt
                        src={selectedGroup.coverUrl}
                        title={selectedGroup.title}
                        artist={selectedGroup.artist}
                        className="h-full w-full"
                        iconSize={26}
                      />
                    </div>
                    <div>
                      <h2 className="text-[20px] font-bold text-white">{selectedGroup.title}</h2>
                      <p className="text-[13px] text-white/60">
                        {selectedGroup.artist} • {selectedGroup.tracks.length} {t.library.tracksUnit}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void playTrack(selectedGroup.tracks[0], selectedGroup.tracks)
                    }
                    className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-black"
                  >
                    <Play size={14} weight="fill" />
                    {t.album.playAll}
                  </button>
                </div>

                <div className="space-y-1">
                  {selectedGroup.tracks.map((tr, i) => (
                    <TrackRow
                      key={tr.id}
                      track={tr}
                      index={i}
                      queueContext={selectedGroup.tracks}
                      showCover={false}
                      showAlbum={false}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="cq-albums-grid">
            {albumGroups
              .filter(
                (g) =>
                  !filter.trim() ||
                  g.title.toLowerCase().includes(filter.toLowerCase()) ||
                  g.artist.toLowerCase().includes(filter.toLowerCase())
              )
              .map((grp) => (
                <div
                  key={grp.key}
                  onClick={() => setOpenedAlbumKey(grp.key)}
                  className="group bezel-outer cursor-pointer transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5"
                >
                  <div className="bezel-inner p-3">
                    <div className="relative aspect-square w-full overflow-hidden rounded-[14px] bg-white/[0.04]">
                      <CoverArt
                        src={grp.coverUrl}
                        title={grp.title}
                        artist={grp.artist}
                        className="h-full w-full"
                        imgClassName="transition-transform duration-700 group-hover:scale-105"
                        iconSize={42}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void playTrack(grp.tracks[0], grp.tracks);
                        }}
                        className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100"
                      >
                        <Play size={17} weight="fill" className="ml-0.5" />
                      </button>
                    </div>
                    <div className="mt-3 px-1">
                      <h3 className="truncate text-[14px] font-semibold text-white">
                        {grp.title}
                      </h3>
                      <p className="mt-0.5 truncate text-[12.5px] text-white/55">
                        {grp.artist} • {grp.tracks.length} {t.library.tracksUnit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )
      ) : (
        (() => {
          const list = filterTracks(tab === 'downloaded' ? downloadedList : localTracks);
          if (list.length === 0) {
            return (
              <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.02] px-6 text-center text-white/50">
                <MusicNotes size={36} weight="light" />
                <p className="max-w-md text-[14px]">
                  {tab === 'downloaded' ? t.library.emptyDownloaded : t.library.emptyLocal}
                </p>
              </div>
            );
          }
          return (
            <div className="bezel-outer">
              <div className="bezel-inner space-y-1 p-3">
                {list.map((tr, i) => (
                  <TrackRow key={tr.id} track={tr} index={i} queueContext={list} />
                ))}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
