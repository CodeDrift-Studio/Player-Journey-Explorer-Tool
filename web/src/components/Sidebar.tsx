/** Left control rail: filters + (in aggregate view) the density-heatmap selector.
 * Layers + statistics land in later features. */

import { useFilterStore } from '../store/filterStore';
import { DateFilter } from './filters/DateFilter';
import { MapFilter } from './filters/MapFilter';
import { MatchFilter } from './filters/MatchFilter';
import { HeatmapControl } from './HeatmapControl';
import { StatsPanel } from './StatsPanel';

export function Sidebar() {
  // Aggregate/overview view (no single match selected) is where the density
  // heatmap applies, so its mode selector shows only there.
  const isAggregate = useFilterStore((s) => s.matchId === null);
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-hidden border-r border-slate-800 bg-slate-900/20 p-4">
      <MapFilter />
      <DateFilter />
      <MatchFilter />
      {isAggregate && (
        <div className="shrink-0 border-t border-slate-800 pt-3">
          <HeatmapControl />
        </div>
      )}
      <div className="shrink-0 border-t border-slate-800 pt-3">
        <StatsPanel />
      </div>
      <div className="shrink-0 border-t border-slate-800 pt-3 text-xs text-slate-600">
        Layers — next
      </div>
    </aside>
  );
}
