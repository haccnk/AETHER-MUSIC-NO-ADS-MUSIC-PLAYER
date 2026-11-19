import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sliders, X } from '@phosphor-icons/react';
import { EQ_FREQUENCIES, EQ_PRESETS } from '../../audio/AudioEngine';
import { usePlayerStore } from '../../store/usePlayerStore';
import { cn } from '../../utils/format';

const FREQ_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

export const EqualizerModal: React.FC = () => {
  const isOpen = usePlayerStore((s) => s.isEqOpen);
  const setEqOpen = usePlayerStore((s) => s.setEqOpen);
  const settings = usePlayerStore((s) => s.settings);
  const updateSettings = usePlayerStore((s) => s.updateSettings);
  const t = usePlayerStore((s) => s.t());

  const handleBandChange = (idx: number, val: number) => {
    const nextBands = [...settings.eqBands];
    nextBands[idx] = val;
    void updateSettings({
      eqBands: nextBands,
      eqPreset: 'custom',
      eqEnabled: true,
    });
  };

  const applyPreset = (presetKey: string) => {
    const bands = EQ_PRESETS[presetKey];
    if (!bands) return;
    void updateSettings({
      eqPreset: presetKey,
      eqBands: [...bands],
      eqEnabled: true,
    });
  };

  // Build smooth SVG polyline/curve points for visual frequency response
  const svgWidth = 560;
  const svgHeight = 96;
  const points = settings.eqBands.map((db, idx) => {
    const x = (idx / (EQ_FREQUENCIES.length - 1)) * (svgWidth - 32) + 16;
    const norm = (12 - db) / 24;
    const y = norm * (svgHeight - 20) + 10;
    return { x, y };
  });

  const pathD = points.reduce((acc, p, idx, arr) => {
    if (idx === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[idx - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={() => setEqOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bezel-outer w-full max-w-[680px] shadow-2xl"
          >
            <div className="bezel-inner bg-[#0C0E16]/90 p-6 backdrop-blur-2xl">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
                    <Sliders size={20} weight="light" />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-bold text-white">{t.eq.title}</h2>
                    <p className="text-[12px] text-white/50">Web Audio BiquadFilter 10-Band DSP</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void updateSettings({ eqEnabled: !settings.eqEnabled })}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all',
                      settings.eqEnabled
                        ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                        : 'border-white/15 bg-white/5 text-white/55'
                    )}
                  >
                    {t.eq.enabled}: {settings.eqEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEqOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div className="mt-5 flex flex-wrap gap-2">
                {Object.keys(EQ_PRESETS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all',
                      settings.eqPreset === key
                        ? 'border-white/35 bg-white text-black font-semibold'
                        : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/10'
                    )}
                  >
                    {t.eq.presets[key as keyof typeof t.eq.presets]}
                  </button>
                ))}
              </div>

              {/* Live SVG Frequency Curve */}
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-3">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-24 w-full">
                  <line
                    x1={16}
                    y1={svgHeight / 2}
                    x2={svgWidth - 16}
                    y2={svgHeight / 2}
                    stroke="rgba(255,255,255,0.12)"
                    strokeDasharray="4 4"
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={settings.eqEnabled ? 'rgba(139, 92, 246, 0.95)' : 'rgba(255,255,255,0.25)'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {points.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={4}
                      fill={settings.eqEnabled ? '#fff' : '#666'}
                    />
                  ))}
                </svg>
              </div>

              {/* 10 Vertical Sliders */}
              <div className="mt-5 grid grid-cols-10 gap-2">
                {FREQ_LABELS.map((label, idx) => {
                  const val = settings.eqBands[idx] ?? 0;
                  return (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <span className="font-mono text-[10.5px] text-white/65 tabular-nums">
                        {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                      </span>
                      <div className="relative flex h-36 w-8 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.07]">
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={0.5}
                          value={val}
                          onChange={(e) => handleBandChange(idx, parseFloat(e.target.value))}
                          style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                          }}
                          className="h-28 w-5 accent-violet-400 cursor-pointer"
                        />
                      </div>
                      <span className="font-mono text-[11px] font-medium text-white/55">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Crossfade Control */}
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-[13.5px] font-semibold text-white">{t.eq.crossfade}</p>
                  <p className="font-mono text-[12px] text-cyan-300 tabular-nums">
                    {settings.crossfadeSeconds === 0
                      ? t.eq.crossfadeOff
                      : t.eq.crossfadeSec.replace('{s}', String(settings.crossfadeSeconds))}
                  </p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={settings.crossfadeSeconds}
                  onChange={(e) =>
                    void updateSettings({ crossfadeSeconds: parseInt(e.target.value, 10) })
                  }
                  style={
                    {
                      '--range-pct': `${Math.round((settings.crossfadeSeconds / 12) * 100)}%`,
                    } as React.CSSProperties
                  }
                  className="aether-range w-48 shrink-0"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
