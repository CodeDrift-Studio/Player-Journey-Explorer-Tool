/**
 * TypeScript mirror of the FROZEN ETL JSON contract (web/public/data/*).
 *
 * This is the single source of truth for the shape of every artifact the app
 * consumes. It matches etl/src/serialize.py exactly. If the ETL contract ever
 * changes, updating these types makes the compiler point at every line to fix.
 */

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';
export type EventCategory = 'kill' | 'death' | 'loot' | 'storm';

/** How a map's world coords project onto its square minimap image. */
export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
  image: string; // filename served under /minimaps
  size: number; // minimap is size × size px (1024)
}

export interface EventCounts {
  kill: number;
  death: number;
  loot: number;
  storm: number;
}

/** One row of the manifest match list — a lightweight summary for the UI. */
export interface MatchSummary {
  matchId: string;
  mapId: MapId;
  date: string; // ISO 'YYYY-MM-DD'
  humanCount: number;
  botCount: number;
  eventCounts: EventCounts;
  pointCount: number;
  durationMs: number;
}

/** manifest.json — loaded once, drives all filters. */
export interface Manifest {
  maps: Record<MapId, MapConfig>;
  dates: string[];
  matches: MatchSummary[];
}

/** Compact movement sample: [ts, px, py] (minimap-pixel space). */
export type PathPoint = [ts: number, px: number, py: number];

export interface MatchEvent {
  t: number; // ms since match start
  cat: EventCategory;
  raw: string; // original event name, e.g. 'BotKill' (for tooltips)
  px: number;
  py: number;
}

export interface MatchPlayer {
  userId: string;
  isBot: boolean;
  path: PathPoint[];
  events: MatchEvent[];
}

/** matches/{matchId}.json — full detail for playback. */
export interface Match {
  matchId: string;
  mapId: MapId;
  date: string;
  startTs: number;
  endTs: number;
  players: MatchPlayer[];
}

/** aggregate/{mapId}_{date}.json — flattened for the overview heatmap. */
export type AggPoint = [px: number, py: number];
export interface AggEvent {
  cat: EventCategory;
  px: number;
  py: number;
}
export interface Aggregate {
  mapId: MapId;
  date: string;
  points: AggPoint[];
  events: AggEvent[];
}
