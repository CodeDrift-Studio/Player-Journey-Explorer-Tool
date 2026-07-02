/**
 * Loaded data + load status. Holds the manifest (loaded once) and the currently
 * active match or aggregate. Components read from here; hooks fill it.
 */

import { create } from 'zustand';
import type { Aggregate, Manifest, Match } from '../types/contract';

export type Status = 'idle' | 'loading' | 'ready' | 'error';

interface DataState {
  manifest: Manifest | null;
  manifestStatus: Status;
  match: Match | null; // active single-match view (null in aggregate mode)
  aggregate: Aggregate | null; // active overview view
  viewStatus: Status; // status of the active match/aggregate load
  error: string | null;
  /** Bumped by retry() to force useSelectedData to re-run the current load. */
  reloadNonce: number;
  setManifest: (manifest: Manifest) => void;
  setManifestStatus: (status: Status) => void;
  setMatch: (match: Match | null) => void;
  setAggregate: (aggregate: Aggregate | null) => void;
  setViewStatus: (status: Status) => void;
  setError: (error: string | null) => void;
  /** Re-attempt the current view load after a failure (no page refresh). */
  retry: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  manifest: null,
  manifestStatus: 'idle',
  match: null,
  aggregate: null,
  viewStatus: 'idle',
  error: null,
  reloadNonce: 0,
  setManifest: (manifest) => set({ manifest }),
  setManifestStatus: (manifestStatus) => set({ manifestStatus }),
  setMatch: (match) => set({ match }),
  setAggregate: (aggregate) => set({ aggregate }),
  setViewStatus: (viewStatus) => set({ viewStatus }),
  setError: (error) => set({ error }),
  retry: () => set((s) => ({ reloadNonce: s.reloadNonce + 1, error: null })),
}));
