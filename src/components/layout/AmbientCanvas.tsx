import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { DEFAULT_AMBIENT_PALETTE, RgbTuple } from '../../utils/colorExtractor';

export const AmbientCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetPalette = usePlayerStore((s) => s.ambientPalette);
  const currentPaletteRef = useRef<RgbTuple[]>(
    DEFAULT_AMBIENT_PALETTE.map((c) => [...c] as RgbTuple)
  );
  const targetRef = useRef<RgbTuple[]>(targetPalette);

  useEffect(() => {
    targetRef.current = targetPalette;
  }, [targetPalette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 160;
    const h = 100;
    canvas.width = w;
    canvas.height = h;

    let raf = 0;
    const startTime = performance.now();

    const draw = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      const cur = currentPaletteRef.current;
      const tgt = targetRef.current;
      for (let i = 0; i < 4; i++) {
        for (let c = 0; c < 3; c++) {
          cur[i][c] += (tgt[i][c] - cur[i][c]) * 0.04;
        }
      }

      ctx.fillStyle = '#07080C';
      ctx.fillRect(0, 0, w, h);

      const orbs = [
        {
          x: w * (0.26 + 0.14 * Math.sin(elapsed * 0.2)),
          y: h * (0.22 + 0.1 * Math.cos(elapsed * 0.17)),
          r: w * 0.52,
          color: cur[0],
          alpha: 0.48,
        },
        {
          x: w * (0.76 + 0.12 * Math.cos(elapsed * 0.15)),
          y: h * (0.26 + 0.14 * Math.sin(elapsed * 0.22)),
          r: w * 0.48,
          color: cur[1],
          alpha: 0.38,
        },
        {
          x: w * (0.5 + 0.16 * Math.sin(elapsed * 0.13 + 1.4)),
          y: h * (0.78 + 0.1 * Math.cos(elapsed * 0.19)),
          r: w * 0.56,
          color: cur[2],
          alpha: 0.32,
        },
        {
          x: w * (0.18 + 0.1 * Math.cos(elapsed * 0.16 + 2.2)),
          y: h * (0.75 + 0.12 * Math.sin(elapsed * 0.14)),
          r: w * 0.42,
          color: cur[3],
          alpha: 0.36,
        },
      ];

      ctx.globalCompositeOperation = 'screen';
      for (const orb of orbs) {
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        const r = Math.round(orb.color[0]);
        const gr = Math.round(orb.color[1]);
        const b = Math.round(orb.color[2]);
        g.addColorStop(0, `rgba(${r}, ${gr}, ${b}, ${orb.alpha})`);
        g.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#07080C]">
      <canvas
        ref={canvasRef}
        className="h-full w-full scale-110 opacity-90 blur-[85px]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-[#07080C]/35 to-[#07080C]/90" />
    </div>
  );
};
