/**
 * Aggregate/overview density-mode selector: Traffic / Kills / Deaths / Loot. Only
 * shown in aggregate mode (the footer Timeline is disabled there). Drives
 * filterStore.heatmapMode, which the canvas reads to paint the density heatmap.
 * A small low→high scale makes the field's intensity legible (a full legend is a
 * later milestone).
 */

import { HEATMAP_BASE } from '../render/palette';
import { HEATMAP_MODES, type HeatmapMode } from '../lib/heatmap';
import { useFilterStore } from '../store/filterStore';
import { SectionLabel } from './ui';

const rgb = (c: readonly [number, number, number]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;
const rgba = (c: readonly [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function HeatmapControl() {
  const mode = useFilterStore((s) => s.heatmapMode);
  const setMode = useFilterStore((s) => s.setHeatmapMode);
  const base = HEATMAP_BASE[mode];

  return (
    <div className="shrink-0">
      <SectionLabel>Density</SectionLabel>
      <div className="grid grid-cols-2 gap-1">
        {HEATMAP_MODES.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key as HeatmapMode)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 ${
                active ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: rgb(HEATMAP_BASE[m.key]) }}
              />
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
        <span>low</span>
        <span
          aria-hidden
          className="h-1.5 flex-1 rounded"
          style={{ background: `linear-gradient(to right, ${rgba(base, 0)}, ${rgba(base, 0.85)}, rgba(255,255,255,0.9))` }}
        />
        <span>high</span>
      </div>
    </div>
  );
}
