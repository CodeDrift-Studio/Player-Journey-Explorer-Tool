/**
 * Loads the manifest once on startup and seeds sensible default filters
 * (the richest match's map + date, so the first view is a populated one).
 *
 * The `cancelled` flag guards against setting state after unmount — the standard
 * React pattern for async effects (React's answer to a CancellationToken).
 */

import { useEffect } from 'react';
import { loadManifest } from '../lib/data';
import { useDataStore } from '../store/dataStore';
import { useFilterStore } from '../store/filterStore';

export function useManifestLoader(): void {
  const setManifest = useDataStore((s) => s.setManifest);
  const setStatus = useDataStore((s) => s.setManifestStatus);
  const setError = useDataStore((s) => s.setError);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    loadManifest()
      .then((manifest) => {
        if (cancelled) return;
        setManifest(manifest);
        setStatus('ready');

        // Seed defaults from the richest match (manifest is sorted richest-first).
        const filters = useFilterStore.getState();
        const top = manifest.matches[0];
        if (top && !filters.mapId) filters.setMap(top.mapId);
        if (top && !filters.date) filters.setDate(top.date);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [setManifest, setStatus, setError]);
}
