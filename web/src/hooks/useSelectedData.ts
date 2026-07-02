/**
 * Reacts to the current selection (map / date / match) and loads the matching
 * artifact into the data store:
 *   - matchId set   -> load that match (single-match view, playback enabled)
 *   - matchId null  -> load the map+date aggregate (overview view)
 *
 * Stores are read via getState() inside the effect (stable references), so the
 * only real dependencies are the selection values.
 */

import { useEffect } from 'react';
import { loadAggregate, loadMatch } from '../lib/data';
import { useDataStore } from '../store/dataStore';
import { useFilterStore } from '../store/filterStore';
import { usePlaybackStore } from '../store/playbackStore';

export function useSelectedData(): void {
  const mapId = useFilterStore((s) => s.mapId);
  const date = useFilterStore((s) => s.date);
  const matchId = useFilterStore((s) => s.matchId);
  // Bumped by dataStore.retry() — re-runs the load with the same selection.
  const reloadNonce = useDataStore((s) => s.reloadNonce);

  useEffect(() => {
    let cancelled = false;
    const data = useDataStore.getState();
    const playback = usePlaybackStore.getState();

    const fail = (err: unknown) => {
      if (cancelled) return;
      data.setError(err instanceof Error ? err.message : String(err));
      data.setViewStatus('error');
    };

    if (matchId) {
      data.setViewStatus('loading');
      data.setAggregate(null);
      loadMatch(matchId)
        .then((match) => {
          if (cancelled) return;
          data.setMatch(match);
          data.setViewStatus('ready');
          playback.setDuration(match.endTs);
          playback.reset();
        })
        .catch(fail);
    } else if (mapId && date) {
      data.setViewStatus('loading');
      data.setMatch(null);
      loadAggregate(mapId, date)
        .then((aggregate) => {
          if (cancelled) return;
          data.setAggregate(aggregate);
          data.setViewStatus('ready');
          playback.setDuration(0); // aggregate has no unified timeline
          playback.reset();
        })
        .catch(fail);
    }

    return () => {
      cancelled = true;
    };
  }, [mapId, date, matchId, reloadNonce]);
}
