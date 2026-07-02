/**
 * Data access layer — fetch the static JSON "API" and cache it.
 *
 * Pure I/O, no React. The static artifacts never change at runtime, so once a
 * match/aggregate is fetched we keep it — re-selecting is instant with zero
 * refetch. We cache the *promise* (not the result) so concurrent requests for
 * the same file dedupe to a single network hit.
 */

import type { Aggregate, Manifest, Match } from '../types/contract';

const BASE = '/data';

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
    promise = fetchJson<Match>(`${BASE}/matches/${matchId}.json`);
    matchCache.set(matchId, promise);
  }
  return promise;
}

/** All journeys for one map+date, flattened — the overview/heatmap payload. */
export function loadAggregate(mapId: string, date: string): Promise<Aggregate> {
  const key = `${mapId}_${date}`;
  let promise = aggregateCache.get(key);
  if (!promise) {
    promise = fetchJson<Aggregate>(`${BASE}/aggregate/${key}.json`);
    aggregateCache.set(key, promise);
  }
  return promise;
}
