import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const secs = Math.floor(totalSeconds);
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export function formatMs(ms: number): string {
  return formatDuration(Math.max(0, ms) / 1000);
}

export function formatTotalAlbumDuration(secondsList: number[], lang: 'vi' | 'en'): string {
  const total = Math.round(secondsList.reduce((acc, s) => acc + (s || 0), 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hrs > 0) {
    return lang === 'vi' ? `${hrs} giờ ${mins} phút` : `${hrs} hr ${mins} min`;
  }
  return lang === 'vi' ? `${mins} phút` : `${mins} min`;
}
