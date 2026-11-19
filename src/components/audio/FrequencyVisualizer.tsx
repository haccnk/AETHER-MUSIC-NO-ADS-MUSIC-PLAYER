import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import { usePlayerStore } from '../../store/usePlayerStore';
import { rgbToCss } from '../../utils/colorExtractor';

interface FrequencyVisualizerProps {
  bars?: number;
  width?: number;
  height?: number;
  className?: string;
}

export const FrequencyVisualizer: React.FC<FrequencyVisualizerProps> = ({
  bars = 24,
  width = 112,
  height = 28,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const palette = usePlayerStore((s) => s.ambientPalette);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const freqData = new Uint8Array(128);
    const smoothed = new Float32Array(bars);
    let raf = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const hasAudio = isPlaying && audioEngine.getFrequencyData(freqData);

      const gap = 2;
      const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);

      const grad = ctx.createLinearGradient(0, height, width, 0);
      grad.addColorStop(0, rgbToCss(palette[0], 0.92));
      grad.addColorStop(1, rgbToCss(palette[1], 0.92));
      ctx.fillStyle = grad;

      for (let i = 0; i < bars; i++) {
        // Focus on musically rich bins (bins 1..52)
        const bin = 1 + Math.floor((i / bars) * 48);
        const raw = hasAudio ? freqData[bin] / 255 : 0.08;
        smoothed[i] += (raw - smoothed[i]) * 0.24;

        const barH = Math.max(3, smoothed[i] * (height - 2));
        const x = i * (barWidth + gap);
        const y = (height - barH) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [bars, width, height, isPlaying, palette]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={className}
    />
  );
};
