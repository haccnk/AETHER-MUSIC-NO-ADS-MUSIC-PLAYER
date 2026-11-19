import { useEffect, useState } from 'react';
import { Track } from '../types/music';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6.5, 5.5, 4.0, 1.5, 0, -0.5, 0.5, 1.5, 2.0, 2.0],
  vocal: [-2.0, -1.5, -0.5, 1.5, 4.0, 4.5, 3.5, 1.5, 0.5, 0],
  acoustic: [3.0, 2.5, 1.0, 0.5, 1.5, 2.0, 3.0, 3.5, 3.0, 2.0],
  electronic: [5.5, 4.5, 1.5, 0, -1.5, 1.0, 2.5, 4.0, 5.0, 5.5],
  hifi: [3.5, 2.5, 0.5, -0.5, 0, 1.0, 2.5, 4.0, 4.5, 5.0],
  latenight: [2.5, 2.0, 1.0, 0, 1.5, 2.0, 1.0, -1.0, -2.5, -3.5],
};

export interface PlaybackTimeSnapshot {
  currentTimeMs: number;
  durationMs: number;
}

type TimeListener = (snap: PlaybackTimeSnapshot) => void;

interface Deck {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  trackId: string | null;
}

class DualDeckAudioEngine {
  private ctx: AudioContext | null = null;
  private deckA: Deck | null = null;
  private deckB: Deck | null = null;
  private activeKey: 'A' | 'B' = 'A';
  private masterGain: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private analyser: AnalyserNode | null = null;

  private eqEnabled = true;
  private eqBands = [...EQ_PRESETS.flat];
  private volume = 0.85;
  private muted = false;
  private crossfadeSeconds = 3;

  private rafId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private freqScratch: Uint8Array<ArrayBuffer> | null = null;

  private transitionId = 0;
  private isSwitching = false;
  private crossfadeInProgress = false;
  private crossfadeTriggeredForId: string | null = null;
  private currentTrackId: string | null = null;
  private crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  private seekTimer: ReturnType<typeof setTimeout> | null = null;

  private timeListeners = new Set<TimeListener>();
  private lastSnapshot: PlaybackTimeSnapshot = { currentTimeMs: 0, durationMs: 0 };

  public onTrackEnded?: () => void;
  public onCrossfadeReady?: () => void;
  public onMediaSessionAction?: (action: 'play' | 'pause' | 'next' | 'prev') => void;
  public onPlaybackError?: (msg: string) => void;
  public onPlayStateChange?: (playing: boolean) => void;

  private ensureContext(): AudioContext {
    if (this.ctx && this.deckA && this.deckB && this.masterGain && this.analyser) {
      return this.ctx;
    }

    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    this.masterGain = master;

    const filters: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, idx) => {
      const f = ctx.createBiquadFilter();
      if (idx === 0) f.type = 'lowshelf';
      else if (idx === EQ_FREQUENCIES.length - 1) f.type = 'highshelf';
      else {
        f.type = 'peaking';
        f.Q.value = 1.4;
      }
      f.frequency.value = freq;
      f.gain.value = this.eqEnabled ? (this.eqBands[idx] ?? 0) : 0;
      return f;
    });
    this.eqFilters = filters;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    this.analyser = analyser;

    let head: AudioNode = master;
    for (const f of filters) {
      head.connect(f);
      head = f;
    }
    head.connect(analyser);
    analyser.connect(ctx.destination);

    const createDeck = (initialGain: number): Deck => {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = initialGain;
      source.connect(gain);
      gain.connect(master);

      const deck: Deck = { audio, source, gain, trackId: null };

      audio.addEventListener('ended', () => {
        if (
          this.getActiveDeck() === deck &&
          deck.trackId !== null &&
          deck.trackId === this.currentTrackId &&
          !this.crossfadeInProgress
        ) {
          this.onTrackEnded?.();
        }
      });

      audio.addEventListener('error', () => {
        if (
          !this.isSwitching &&
          this.getActiveDeck() === deck &&
          deck.trackId !== null &&
          deck.trackId === this.currentTrackId &&
          Boolean(audio.getAttribute('src'))
        ) {
          this.onPlaybackError?.(audio.error?.message || 'Audio stream playback error');
        }
      });

      audio.addEventListener('play', () => {
        if (
          !this.isSwitching &&
          this.getActiveDeck() === deck &&
          deck.trackId !== null &&
          deck.trackId === this.currentTrackId
        ) {
          this.onPlayStateChange?.(true);
        }
      });

      audio.addEventListener('pause', () => {
        if (
          !this.isSwitching &&
          !audio.ended &&
          this.getActiveDeck() === deck &&
          deck.trackId !== null &&
          deck.trackId === this.currentTrackId
        ) {
          this.onPlayStateChange?.(false);
        }
      });

      return deck;
    };

    this.deckA = createDeck(1);
    this.deckB = createDeck(0);
    this.startLoop();
    this.setupMediaSession();

    return ctx;
  }

  private getActiveDeck(): Deck | null {
    return this.activeKey === 'A' ? this.deckA : this.deckB;
  }

  private getStandbyDeck(): Deck | null {
    return this.activeKey === 'A' ? this.deckB : this.deckA;
  }

  private clearTimers(): void {
    if (this.crossfadeTimer) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    if (this.seekTimer) {
      clearTimeout(this.seekTimer);
      this.seekTimer = null;
    }
  }

  private hardStopDeck(deck: Deck | null): void {
    if (!deck) return;
    deck.trackId = null;
    try {
      deck.audio.pause();
      if (deck.audio.readyState > 0) {
        deck.audio.currentTime = 0;
      }
    } catch {
      // Ignore deck reset failure
    }
    if (this.ctx) {
      const now = this.ctx.currentTime;
      deck.gain.gain.cancelScheduledValues(now);
      deck.gain.gain.setValueAtTime(0, now);
    } else {
      deck.gain.gain.value = 0;
    }
  }

  public stopAll(): void {
    ++this.transitionId;
    this.isSwitching = false;
    this.clearTimers();
    this.crossfadeInProgress = false;
    this.crossfadeTriggeredForId = null;
    this.hardStopDeck(this.deckA);
    this.hardStopDeck(this.deckB);
  }

  public setPendingTrack(trackId: string, keepOutgoingPlaying: boolean): void {
    this.currentTrackId = trackId;
    this.crossfadeTriggeredForId = null;
    if (keepOutgoingPlaying) {
      this.crossfadeInProgress = true;
    } else {
      ++this.transitionId;
      this.clearTimers();
      this.crossfadeInProgress = false;
      this.hardStopDeck(this.deckA);
      this.hardStopDeck(this.deckB);
    }

    this.lastSnapshot = { currentTimeMs: 0, durationMs: 0 };
    for (const fn of this.timeListeners) {
      fn(this.lastSnapshot);
    }
  }

  private samplePlaybackState(): PlaybackTimeSnapshot {
    const active = this.getActiveDeck();
    if (active && active.trackId !== null && active.trackId === this.currentTrackId && active.audio.src) {
      const curMs = Math.round((active.audio.currentTime || 0) * 1000);
      const dur = Number.isFinite(active.audio.duration) ? active.audio.duration : 0;
      const durMs = Math.round(dur * 1000);

      this.lastSnapshot = { currentTimeMs: curMs, durationMs: durMs };
      for (const fn of this.timeListeners) {
        fn(this.lastSnapshot);
      }

      if (
        !active.audio.paused &&
        !this.crossfadeInProgress &&
        this.crossfadeSeconds > 0 &&
        dur > this.crossfadeSeconds + 6 &&
        dur - active.audio.currentTime <= this.crossfadeSeconds &&
        this.crossfadeTriggeredForId !== this.currentTrackId
      ) {
        this.crossfadeTriggeredForId = this.currentTrackId;
        this.onCrossfadeReady?.();
      }
    } else {
      this.lastSnapshot = { currentTimeMs: 0, durationMs: 0 };
      for (const fn of this.timeListeners) {
        fn(this.lastSnapshot);
      }
    }
    return this.lastSnapshot;
  }

  private startLoop(): void {
    if (this.rafId === null) {
      const tick = () => {
        this.samplePlaybackState();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    // Keep playback clock & crossfade alive even when main window is minimized or occluded
    if (this.intervalId === null) {
      this.intervalId = setInterval(() => {
        this.samplePlaybackState();
      }, 75);
    }
  }

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => this.onMediaSessionAction?.('play'));
      navigator.mediaSession.setActionHandler('pause', () => this.onMediaSessionAction?.('pause'));
      navigator.mediaSession.setActionHandler('nexttrack', () =>
        this.onMediaSessionAction?.('next')
      );
      navigator.mediaSession.setActionHandler('previoustrack', () =>
        this.onMediaSessionAction?.('prev')
      );
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          this.seek(details.seekTime * 1000);
        }
      });
    } catch {
      // Ignore unsupported media session actions
    }
  }

  public updateMediaMetadata(track: Track): void {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Aether Music',
        artwork: track.coverUrl
          ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
    } catch {
      // Ignore
    }
  }

  public subscribeTime(listener: TimeListener): () => void {
    this.timeListeners.add(listener);
    listener(this.lastSnapshot);
    return () => this.timeListeners.delete(listener);
  }

  public getCurrentSnapshot(): PlaybackTimeSnapshot {
    const active = this.getActiveDeck();
    if (active && active.trackId !== null && active.trackId === this.currentTrackId && active.audio.src) {
      const curMs = Math.round((active.audio.currentTime || 0) * 1000);
      const dur = Number.isFinite(active.audio.duration) ? active.audio.duration : 0;
      const durMs = Math.round(dur * 1000);
      this.lastSnapshot = { currentTimeMs: curMs, durationMs: durMs };
    } else {
      this.lastSnapshot = { currentTimeMs: 0, durationMs: 0 };
    }
    return this.lastSnapshot;
  }

  public isPlaying(): boolean {
    const active = this.getActiveDeck();
    return Boolean(
      active &&
        active.trackId !== null &&
        active.trackId === this.currentTrackId &&
        !active.audio.paused &&
        !active.audio.ended
    );
  }

  public getCompactSpectrum(bins = 28): number[] {
    if (!this.analyser || !this.isPlaying()) return [];

    const needed = this.analyser.frequencyBinCount;
    if (!this.freqScratch || this.freqScratch.length !== needed) {
      this.freqScratch = new Uint8Array(new ArrayBuffer(needed));
    }
    this.analyser.getByteFrequencyData(this.freqScratch);

    const usable = Math.max(bins, Math.floor(needed * 0.72));
    const step = Math.max(1, Math.floor(usable / bins));
    const out: number[] = [];
    for (let i = 0; i < bins; i++) {
      let peak = 0;
      const base = i * step;
      for (let j = 0; j < step; j++) {
        const val = this.freqScratch[Math.min(needed - 1, base + j)] ?? 0;
        if (val > peak) peak = val;
      }
      out.push(Number(Math.pow(peak / 255, 0.85).toFixed(3)));
    }
    return out;
  }

  public getOutputLatencyMs(): number {
    if (!this.ctx) return 0;
    const out = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    const base = this.ctx.baseLatency ?? 0;
    return Math.min(350, Math.round((out + base) * 1000));
  }

  public getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false;
    this.analyser.getByteFrequencyData(target);
    return true;
  }

  public async playTrack(url: string, track: Track, useCrossfade = false): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const txId = ++this.transitionId;
    this.clearTimers();
    this.isSwitching = true;

    const outgoing = this.getActiveDeck()!;
    const incoming = this.getStandbyDeck()!;

    const canCrossfade =
      useCrossfade &&
      this.crossfadeSeconds > 0 &&
      !outgoing.audio.paused &&
      !outgoing.audio.ended &&
      outgoing.trackId !== null &&
      outgoing.trackId !== track.id;

    this.updateMediaMetadata(track);
    this.currentTrackId = track.id;
    this.crossfadeTriggeredForId = null;

    if (canCrossfade) {
      this.crossfadeInProgress = true;
      this.activeKey = this.activeKey === 'A' ? 'B' : 'A';

      incoming.trackId = track.id;
      incoming.audio.src = url;
      incoming.audio.currentTime = 0;

      const startNow = ctx.currentTime;
      incoming.gain.gain.cancelScheduledValues(startNow);
      incoming.gain.gain.setValueAtTime(0.001, startNow);

      try {
        await incoming.audio.play();
      } finally {
        this.isSwitching = false;
      }

      if (txId !== this.transitionId) {
        this.hardStopDeck(incoming);
        return;
      }

      const now = ctx.currentTime;
      const fadeDur = Math.max(0.5, this.crossfadeSeconds);
      const curOutGain = Math.max(0.001, outgoing.gain.gain.value);

      outgoing.gain.gain.cancelScheduledValues(now);
      outgoing.gain.gain.setValueAtTime(curOutGain, now);
      outgoing.gain.gain.linearRampToValueAtTime(0.0001, now + fadeDur);

      incoming.gain.gain.cancelScheduledValues(now);
      incoming.gain.gain.setValueAtTime(0.001, now);
      incoming.gain.gain.linearRampToValueAtTime(1, now + fadeDur);

      this.crossfadeTimer = setTimeout(() => {
        if (txId !== this.transitionId) return;
        this.hardStopDeck(outgoing);
        const endNow = ctx.currentTime;
        incoming.gain.gain.cancelScheduledValues(endNow);
        incoming.gain.gain.setValueAtTime(1, endNow);
        this.crossfadeInProgress = false;
        this.crossfadeTimer = null;
      }, fadeDur * 1000 + 80);
      return;
    }

    // Immediate switch: silence standby AND outgoing before loading incoming
    this.crossfadeInProgress = false;
    this.hardStopDeck(incoming);
    this.hardStopDeck(outgoing);

    outgoing.trackId = track.id;
    const now = ctx.currentTime;
    outgoing.gain.gain.cancelScheduledValues(now);
    outgoing.gain.gain.setValueAtTime(1, now);
    outgoing.audio.src = url;
    outgoing.audio.currentTime = 0;

    try {
      await outgoing.audio.play();
    } finally {
      this.isSwitching = false;
    }

    if (txId !== this.transitionId) {
      this.hardStopDeck(outgoing);
      return;
    }
    this.hardStopDeck(incoming);
  }

  public async setPlaying(playing: boolean): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Ensure the standby deck is always silenced before changing active state
    this.clearTimers();
    this.crossfadeInProgress = false;
    this.hardStopDeck(this.getStandbyDeck());

    const active = this.getActiveDeck();
    if (!active || !active.audio.src || active.trackId === null) return;

    const now = ctx.currentTime;
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(1, now);

    if (playing) {
      await active.audio.play();
    } else {
      active.audio.pause();
    }
  }

  public seek(ms: number): void {
    const active = this.getActiveDeck();
    const ctx = this.ctx;
    if (
      !active ||
      !ctx ||
      active.trackId !== this.currentTrackId ||
      !Number.isFinite(active.audio.duration)
    ) {
      return;
    }

    const dur = active.audio.duration;
    const targetSec = Math.max(0, Math.min(dur - 0.05, ms / 1000));
    const now = ctx.currentTime;

    if (this.crossfadeSeconds > 0 && targetSec < dur - this.crossfadeSeconds - 2) {
      this.crossfadeTriggeredForId = null;
    }

    if (this.seekTimer) {
      clearTimeout(this.seekTimer);
      this.seekTimer = null;
    }

    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(Math.max(0.05, active.gain.gain.value), now);
    active.gain.gain.linearRampToValueAtTime(0.05, now + 0.025);

    this.seekTimer = setTimeout(() => {
      active.audio.currentTime = targetSec;
      const t = ctx.currentTime;
      active.gain.gain.setValueAtTime(0.05, t);
      active.gain.gain.linearRampToValueAtTime(1, t + 0.04);
      this.seekTimer = null;
    }, 28);
  }

  public setVolume(vol: number, muted = this.muted): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  public setSleepAttenuation(factor: number): void {
    if (this.masterGain && this.ctx) {
      const target = (this.muted ? 0 : this.volume) * Math.max(0, Math.min(1, factor));
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  public setCrossfadeSeconds(seconds: number): void {
    this.crossfadeSeconds = Math.max(0, Math.min(12, seconds));
  }

  public setEqualizer(enabled: boolean, bands: number[]): void {
    this.eqEnabled = enabled;
    this.eqBands = bands.slice(0, 10);
    if (!this.ctx || this.eqFilters.length === 0) return;

    const now = this.ctx.currentTime;
    this.eqFilters.forEach((filter, idx) => {
      const gainVal = enabled ? (this.eqBands[idx] ?? 0) : 0;
      filter.gain.setTargetAtTime(gainVal, now, 0.03);
    });
  }
}

export const audioEngine = new DualDeckAudioEngine();

export function usePlaybackTime(): PlaybackTimeSnapshot {
  const [snap, setSnap] = useState<PlaybackTimeSnapshot>(() =>
    audioEngine.getCurrentSnapshot()
  );

  useEffect(() => {
    return audioEngine.subscribeTime((next) => {
      setSnap(next);
    });
  }, []);

  return snap;
}
