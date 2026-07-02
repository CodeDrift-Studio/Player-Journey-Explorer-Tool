/**
 * Filter/selection state: which map, date, and match are being viewed, plus
 * layer visibility toggles. Kept separate from playback so high-frequency
 * playback updates never re-render the filter UI.
 */

import { create } from 'zustand';
import type { MapId } from '../types/contract';

export type LayerKey = 'paths' | 'humans' | 'bots' | 'events' | 'heatmap';

interface FilterState {
  mapId: MapId | null;
  date: string | null;
  /** null = aggregate (whole map+date) view; a string = a single match. */
  matchId: string | null;
  layers: Record<LayerKey, boolean>;
  setMap: (mapId: MapId | null) => void;
  setDate: (date: string | null) => void;
  setMatch: (matchId: string | null) => void;
  toggleLayer: (key: LayerKey) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  mapId: null,
  date: null,
  matchId: null,
  layers: { paths: true, humans: true, bots: true, events: true, heatmap: false },

  // Changing map or date invalidates the selected match (it belonged to the old
  // scope), so we drop back to the aggregate view.
  setMap: (mapId) => set({ mapId, matchId: null }),
  setDate: (date) => set({ date, matchId: null }),
  setMatch: (matchId) => set({ matchId }),
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
}));
