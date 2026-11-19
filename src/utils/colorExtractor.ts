export type RgbTuple = [number, number, number];

export const DEFAULT_AMBIENT_PALETTE: RgbTuple[] = [
  [109, 93, 252], // Deep indigo-violet
  [56, 189, 248], // Cyan mist
  [217, 70, 239], // Soft orchid
  [20, 28, 58],   // Midnight navy
];

function boostColor(r: number, g: number, b: number): RgbTuple {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  // Boost saturation mildly so dark covers still cast vivid ambient light
  const satFactor = max - min < 25 ? 1.0 : 1.35;
  const clamp = (v: number) => Math.max(18, Math.min(240, Math.round(v)));
  return [
    clamp(avg + (r - avg) * satFactor),
    clamp(avg + (g - avg) * satFactor),
    clamp(avg + (b - avg) * satFactor),
  ];
}

export async function extractAmbientPalette(coverUrl?: string): Promise<RgbTuple[]> {
  if (!coverUrl) return DEFAULT_AMBIENT_PALETTE;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(DEFAULT_AMBIENT_PALETTE), 2500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_AMBIENT_PALETTE);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Sample 4 quadrants for smooth multi-orb color diversity
        const quadrants: RgbTuple[] = [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ];
        const counts = [0, 0, 0, 0];

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 14 || lum > 246) continue;
            const q = (y >= size / 2 ? 2 : 0) + (x >= size / 2 ? 1 : 0);
            quadrants[q][0] += r;
            quadrants[q][1] += g;
            quadrants[q][2] += b;
            counts[q]++;
          }
        }

        const palette: RgbTuple[] = quadrants.map((sum, i) => {
          const c = counts[i];
          if (c === 0) return DEFAULT_AMBIENT_PALETTE[i];
          return boostColor(sum[0] / c, sum[1] / c, sum[2] / c);
        });

        resolve(palette);
      } catch {
        resolve(DEFAULT_AMBIENT_PALETTE);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(DEFAULT_AMBIENT_PALETTE);
    };

    img.src = coverUrl;
  });
}

export function rgbToCss(rgb: RgbTuple, alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
