/** Left control rail: filters now; layers + statistics land in later features. */

import { DateFilter } from './filters/DateFilter';
import { MapFilter } from './filters/MapFilter';
import { MatchFilter } from './filters/MatchFilter';

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-hidden border-r border-slate-800 bg-slate-900/20 p-3">
      <MapFilter />
      <DateFilter />
      <MatchFilter />
      <div className="shrink-0 border-t border-slate-800 pt-2 text-[11px] text-slate-600">
        Layers · Statistics — next
      </div>
    </aside>
  );
}
