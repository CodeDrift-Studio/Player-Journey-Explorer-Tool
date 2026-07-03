/**
 * Per-selection statistics for the sidebar. Presents the numbers behind the current
 * view — a single match (players + human/bot split, duration, points, event
 * breakdown) or the map/day aggregate (points + event breakdown). All counting is
 * pure in lib/stats.ts; this component only formats. Reads dataStore, so it updates
 * on selection change and never touches the canvas render path.
 */

import { formatSeconds } from '../lib/format';
import { aggregateStats, EVENT_CATEGORIES, matchStats } from '../lib/stats';
import { COLORS } from '../render/palette';
import type { EventBreakdown } from '../lib/stats';
import type { EventCategory } from '../types/contract';
import { useDataStore } from '../store/dataStore';
import { SectionLabel } from './ui';

const EVENT_LABEL: Record<EventCategory, string> = {
  kill: 'Kills',
  death: 'Deaths',
  loot: 'Loot',
  storm: 'Storm',
};

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-slate-100">{value}</span>
    </div>
  );
}

function EventRows({ events }: { events: EventBreakdown }) {
  return (
    <div className="mt-1.5 border-t border-slate-800 pt-1.5">
      {EVENT_CATEGORIES.map((cat) => (
        <div key={cat} className="flex items-center justify-between gap-2 py-1">
          <span className="flex items-center gap-2 text-slate-400">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.event[cat] }} />
            {EVENT_LABEL[cat]}
          </span>
          <span className="font-mono font-semibold tabular-nums text-slate-100">{events[cat].toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsPanel() {
  const match = useDataStore((s) => s.match);
  const aggregate = useDataStore((s) => s.aggregate);
  const viewStatus = useDataStore((s) => s.viewStatus);

  let body;
  if (viewStatus === 'loading') {
    body = <div className="text-slate-600">…</div>;
  } else if (match) {
    const s = matchStats(match);
    body = (
      <div className="text-[0.8125rem]">
        <Row label="Players" value={`${s.players}  (${s.humans}H · ${s.bots}B)`} />
        <Row label="Duration" value={formatSeconds(s.durationMs)} />
        <Row label="Points" value={s.points.toLocaleString()} />
        <Row label="Events" value={s.totalEvents.toLocaleString()} />
        <EventRows events={s.events} />
      </div>
    );
  } else if (aggregate) {
    const s = aggregateStats(aggregate);
    body = (
      <div className="text-[0.8125rem]">
        <Row label="Points" value={s.points.toLocaleString()} />
        <Row label="Events" value={s.totalEvents.toLocaleString()} />
        <EventRows events={s.events} />
      </div>
    );
  } else {
    body = <div className="text-slate-600">No selection.</div>;
  }

  return (
    <div className="shrink-0">
      <SectionLabel>Statistics</SectionLabel>
      {body}
    </div>
  );
}
