/**
 * On-screen key, overlaid top-right of the viewport. Context-aware: in match view it
 * explains the path colors + event glyphs; in aggregate view it shows the active
 * heatmap mode's intensity scale + the event glyphs (which still overlay the field).
 *
 * Reads colors straight from render/palette.ts (the same source scene.ts draws from),
 * so the key can never drift from the canvas. Purely presentational — subscribes only
 * to filterStore (view mode + heatmap mode), so it never re-renders during playback.
 */

import { HEATMAP_MODES } from '../lib/heatmap';
import { COLORS, HEATMAP_BASE } from '../render/palette';
import { useFilterStore } from '../store/filterStore';
import type { EventCategory } from '../types/contract';

const EVENT_LABEL: Record<EventCategory, string> = {
  kill: 'Kill',
  death: 'Death',
  loot: 'Loot',
  storm: 'Storm',
};
const EVENT_ORDER: readonly EventCategory[] = ['kill', 'death', 'loot', 'storm'];
const rgba = (c: readonly [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** 12×12 glyph mirroring render/scene.ts drawMarker (center 6,6, r≈4). */
function Glyph({ cat }: { cat: EventCategory }) {
  const c = COLORS.event[cat];
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden className="shrink-0">
      {cat === 'kill' && (
        <g stroke={c} strokeWidth="1.5">
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2" y2="10" />
        </g>
      )}
      {cat === 'death' && (
        <g stroke={c} strokeWidth="1.5">
          <line x1="2" y1="6" x2="10" y2="6" />
          <line x1="6" y1="2" x2="6" y2="10" />
        </g>
      )}
      {cat === 'loot' && <polygon points="6,2 10,6 6,10 2,6" fill={c} />}
      {cat === 'storm' && <polygon points="6,2 10,10 2,10" fill={c} />}
    </svg>
  );
}

function Row({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {swatch}
      <span className="text-slate-200">{label}</span>
    </div>
  );
}

function PathSwatch({ color, width }: { color: string; width: number }) {
  return (
    <svg width="16" height="14" viewBox="0 0 14 12" aria-hidden className="shrink-0">
      <line x1="1" y1="6" x2="13" y2="6" stroke={color} strokeWidth={width} strokeLinecap="round" />
    </svg>
  );
}

export function Legend() {
  const isAggregate = useFilterStore((s) => s.matchId === null);
  const heatmapMode = useFilterStore((s) => s.heatmapMode);
  const base = HEATMAP_BASE[heatmapMode];
  const modeLabel = HEATMAP_MODES.find((m) => m.key === heatmapMode)?.label ?? '';

  return (
    <div className="pointer-events-none absolute right-2 top-2 flex flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-[0.6875rem] leading-snug">
      {isAggregate ? (
        <>
          <div className="font-semibold uppercase tracking-wider text-slate-400">{modeLabel} density</div>
          <div className="flex items-center gap-1 text-slate-500">
            <span>low</span>
            <span
              aria-hidden
              className="h-2 w-16 rounded"
              style={{ background: `linear-gradient(to right, ${rgba(base, 0)}, ${rgba(base, 0.85)}, rgba(255,255,255,0.9))` }}
            />
            <span>high</span>
          </div>
          <div className="mt-1.5 border-t border-slate-800 pt-1.5 font-semibold uppercase tracking-wider text-slate-400">Events</div>
          {EVENT_ORDER.map((cat) => (
            <Row key={cat} swatch={<Glyph cat={cat} />} label={EVENT_LABEL[cat]} />
          ))}
        </>
      ) : (
        <>
          <div className="font-semibold uppercase tracking-wider text-slate-400">Paths</div>
          <Row swatch={<PathSwatch color={COLORS.human} width={1.5} />} label="Human" />
          <Row swatch={<PathSwatch color={COLORS.bot} width={1} />} label="Bot" />
          <div className="mt-1.5 border-t border-slate-800 pt-1.5 font-semibold uppercase tracking-wider text-slate-400">Events</div>
          {EVENT_ORDER.map((cat) => (
            <Row key={cat} swatch={<Glyph cat={cat} />} label={EVENT_LABEL[cat]} />
          ))}
        </>
      )}
    </div>
  );
}
