/**
 * Dashboard shell — the tool layout: header (identity + active view) · sidebar
 * (filters) · main viewport · footer (timeline). Timeline is a placeholder for
 * its own milestone; filters and the viewport are live.
 */

import { MapViewport } from './components/MapViewport';
import { Sidebar } from './components/Sidebar';
import { useManifestLoader } from './hooks/useManifest';
import { useSelectedData } from './hooks/useSelectedData';
import { shortDate } from './lib/format';
import { useDataStore } from './store/dataStore';
import { useFilterStore } from './store/filterStore';

function ActiveView() {
  const mapId = useFilterStore((s) => s.mapId);
  const date = useFilterStore((s) => s.date);
  const matchId = useFilterStore((s) => s.matchId);
  const viewStatus = useDataStore((s) => s.viewStatus);
  const match = useDataStore((s) => s.match);
  const aggregate = useDataStore((s) => s.aggregate);

  if (!mapId || !date) return null;

  const scope = matchId ? matchId.slice(0, 8) : 'aggregate';
  const detail =
    viewStatus === 'loading'
      ? 'loading…'
      : viewStatus === 'error'
        ? 'error'
        : match
          ? `${match.players.length} players`
          : aggregate
            ? `${aggregate.points.length} points`
            : '';

  return (
    <span className="font-mono text-xs text-slate-500">
      {mapId} · {shortDate(date)} · {scope}
      {detail && <span className="text-slate-600"> · {detail}</span>}
    </span>
  );
}

function App() {
  useManifestLoader();
  useSelectedData();

  const manifest = useDataStore((s) => s.manifest);
  const manifestStatus = useDataStore((s) => s.manifestStatus);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/40 px-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight text-slate-100">LILA BLACK</span>
          <span className="text-xs text-slate-500">Player Journey Explorer</span>
        </div>
        {manifestStatus === 'ready' && manifest ? (
          <ActiveView />
        ) : (
          <span className={`font-mono text-xs ${manifestStatus === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
            {manifestStatus === 'loading' ? 'loading manifest…' : manifestStatus === 'error' ? 'failed to load data' : ''}
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {manifestStatus === 'ready' ? (
          <>
            <Sidebar />
            <main className="min-w-0 flex-1">
              <MapViewport />
            </main>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm">
            {manifestStatus === 'error' ? (
              <span className="text-red-400">
                Failed to load data. Ensure the ETL has run (<code>python -m src.main</code>) and refresh.
              </span>
            ) : (
              <span className="text-slate-500">Loading data…</span>
            )}
          </div>
        )}
      </div>

      <footer className="flex h-12 shrink-0 items-center border-t border-slate-800 bg-slate-900/40 px-3 text-xs text-slate-600">
        Timeline — playback milestone
      </footer>
    </div>
  );
}

export default App;
