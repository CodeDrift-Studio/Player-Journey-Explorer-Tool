/**
 * Data access layer — fetch the static JSON "API" and cache it.
 *
 * Pure I/O, no React. The static artifacts never change at runtime, so once a
 * match/aggregate is fetched we keep it — re-selecting is instant with zero
 * refetch. We cache the *promise* (not the result) so concurrent requests for
 * the same file dedupe to a single network hit.
 *
 * A rejected request is EVICTED from the cache (never cached permanently), so a
 * later retry re-fetches instead of replaying the same failure forever.
 */

import type { Aggregate, Manifest, Match } from '../types/contract';

// import.meta.env.BASE_URL is Vite's configured `base` (e.g. "/lila/"), so the
// static-JSON "API" resolves correctly whether served from the domain root or a
// subdirectory. BASE_URL always carries a trailing slash.
const BASE = `${import.meta.env.BASE_URL}data`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

const matchCache = new Map<string, Promise<Match>>();
const aggregateCache = new Map<string, Promise<Aggregate>>();

/** The filter index. Small (~25 KB gz); loaded once on startup. */
export function loadManifest(): Promise<Manifest> {
  return fetchJson<Manifest>(`${BASE}/manifest.json`);
}

/** One match's full detail — loaded lazily when selected. */
export function loadMatch(matchId: string): Promise<Match> {
  let promise = matchCache.get(matchId);
  if (!promise) {
    // Evict on failure: a rejected request must not poison the cache, or every
    // future retry would replay the same rejection.
    promise = fetchJson<Match>(`${BASE}/matches/${matchId}.json`).catch((err) => {
      matchCache.delete(matchId);
      throw err;
    });
    matchCache.set(matchId, promise);
  }
  return promise;
}

/** All journeys for one map+date, flattened — the overview/heatmap payload. */
export function loadAggregate(mapId: string, date: string): Promise<Aggregate> {
  const key = `${mapId}_${date}`;
  let promise = aggregateCache.get(key);
  if (!promise) {
    // Evict on failure (see loadMatch): keep the cache free of rejected promises.
    promise = fetchJson<Aggregate>(`${BASE}/aggregate/${key}.json`).catch((err) => {
      aggregateCache.delete(key);
      throw err;
    });
    aggregateCache.set(key, promise);
  }
  return promise;
}
