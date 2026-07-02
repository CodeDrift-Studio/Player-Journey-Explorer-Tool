/**
 * Match picker for the selected map+date. Shows an "All matches (aggregate)"
 * option first, then a searchable, richness-annotated list (1H·15B·20e) so a
 * designer can spot the meaty matches fast. Scrolls independently; grows to
 * fill the sidebar's remaining height.
 */

import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useFilterStore } from '../../store/filterStore';
import type { MatchSummary } from '../../types/contract';
import { SectionLabel, optionButton } from '../ui';

function eventTotal(m: MatchSummary): number {
  const e = m.eventCounts;
  return e.kill + e.death + e.loot + e.storm;
}

export function MatchFilter() {
  const manifest = useDataStore((s) => s.manifest);
  const mapId = useFilterStore((s) => s.mapId);
  const date = useFilterStore((s) => s.date);
  const matchId = useFilterStore((s) => s.matchId);
  const setMatch = useFilterStore((s) => s.setMatch);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    if (!manifest || !mapId || !date) return [];
    return manifest.matches.filter(
      (m) => m.mapId === mapId && m.date === date && (!query || m.matchId.startsWith(query)),
    );
  }, [manifest, mapId, date, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionLabel>Match ({list.length})</SectionLabel>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="jump to id…"
        aria-label="Search match by id prefix"
        className="mb-1.5 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-600 focus:outline-none"
      />

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {/* Aggregate (overview) is a first-class option. */}
        <button className={optionButton(matchId === null)} onClick={() => setMatch(null)}>
          All matches (aggregate)
        </button>

        {list.map((m) => {
          const active = matchId === m.matchId;
          return (
            <button key={m.matchId} className={optionButton(active)} onClick={() => setMatch(m.matchId)}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">{m.matchId.slice(0, 8)}</span>
                <span className={`shrink-0 font-mono ${active ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {m.humanCount}H·{m.botCount}B·{eventTotal(m)}e
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
