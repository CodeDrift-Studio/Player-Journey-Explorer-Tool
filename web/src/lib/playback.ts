/**
 * Pure playback logic — no React, no canvas, no store. Everything the timeline
 * needs to answer "what is visible at time T?" lives here so it can be unit-tested
 * in isolation and reused by both the renderer (scene.ts) and the Timeline UI.
 *
 * Time model: a match's telemetry `ts` runs [0, endTs] in **milliseconds**, but a
 * whole match spans well under one second (median ~380ms, max ~890ms). Playing that
 * back at real time would be an imperceptible blink, so playback maps a full match
 * to a fixed wall-clock window (PLAYBACK_FULL_WALL_MS) at 1× speed. `speed` scales
 * that window; the store's `time`/`duration` stay in honest telemetry milliseconds.
 */

import type { Match, PathPoint } from '../types/contract';

/** Selectable speed multipliers for the timeline. */
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;

/** Wall-clock milliseconds to play a full match at 1× speed. */
export const PLAYBACK_FULL_WALL_MS = 8000;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Clamp a requested time into the valid [0, duration] range (0 if no timeline). */
export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time) || duration <= 0) return 0;
  return time < 0 ? 0 : time > duration ? duration : time;
}

/**
 * Telemetry-ms advanced per wall-clock-ms for this match at `speed`. A full match
 * (0..duration) therefore plays in PLAYBACK_FULL_WALL_MS / speed wall-clock ms.
 * Returns 0 when there is no timeline so playback simply can't advance.
 */
export function playbackRate(
  duration: number,
  speed: number,
  fullWallMs: number = PLAYBACK_FULL_WALL_MS,
): number {
  if (duration <= 0 || fullWallMs <= 0) return 0;
  return (duration / fullWallMs) * speed;
}

/**
 * Advance the playhead by `wallDtMs` of real elapsed time. Clamps to [0, duration]
 * and reports `ended` when it reaches the end so the caller can auto-pause and
 * leave the playhead parked at the end (no auto-rewind).
 */
export function advanceTime(
  time: number,
  wallDtMs: number,
  rate: number,
  duration: number,
): { time: number; ended: boolean } {
  if (duration <= 0) return { time: 0, ended: true };
  const next = time + wallDtMs * rate;
  if (next >= duration) return { time: duration, ended: true };
  return { time: next < 0 ? 0 : next, ended: false };
}

/**
 * Index of the last path point whose `ts` is <= `time` (binary search — paths are
 * time-ordered). Returns -1 when the player hasn't appeared yet (or an empty path).
 */
export function revealedIndex(path: PathPoint[], time: number): number {
  let lo = 0;
  let hi = path.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (path[mid][0] <= time) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export interface PathHead {
  /** Index of the last fully-revealed point (the polyline runs [0..index]). */
  index: number;
  /** Interpolated current position between `index` and `index+1` at `time`. */
  px: number;
  py: number;
}

/**
 * The player's exact position at `time`: the last revealed point, linearly
 * interpolated toward the next point by how far `time` has progressed into that
 * segment. Returns null if the player hasn't appeared yet. This partial-segment
 * interpolation is what makes the head move smoothly between samples.
 */
export function pathHead(path: PathPoint[], time: number): PathHead | null {
  const index = revealedIndex(path, time);
  if (index < 0) return null;
  const [bts, bpx, bpy] = path[index];
  const next = path[index + 1];
  if (!next) return { index, px: bpx, py: bpy };
  const [nts, npx, npy] = next;
  const span = nts - bts;
  const frac = span > 0 ? clamp01((time - bts) / span) : 0;
  return { index, px: bpx + (npx - bpx) * frac, py: bpy + (npy - bpy) * frac };
}

/** Count events that have occurred by `time` (no ordering assumption — lists are tiny). */
export function revealedEventCount(events: { t: number }[], time: number): number {
  let n = 0;
  for (const e of events) {
    if (e.t <= time) n++;
  }
  return n;
}

/**
 * Playback information for the current match at `time`. Intentionally a superset of
 * what the Timeline shows today (time/duration/speed + visible vs. total players and
 * events) so future consumers (stats panel, tooltips) can read it without changing
 * this signature. Counts reflect the timeline position only — layer toggles are a
 * separate rendering concern.
 */
export interface PlaybackStats {
  time: number;
  duration: number;
  speed: number;
  visiblePlayers: number;
  totalPlayers: number;
  visibleEvents: number;
  totalEvents: number;
}

export function computePlaybackStats(
  match: Match | null,
  time: number,
  duration: number,
  speed: number,
): PlaybackStats {
  let visiblePlayers = 0;
  let totalPlayers = 0;
  let visibleEvents = 0;
  let totalEvents = 0;

  if (match) {
    for (const p of match.players) {
      if (p.path.length > 0) {
        totalPlayers++;
        if (revealedIndex(p.path, time) >= 0) visiblePlayers++;
      }
      totalEvents += p.events.length;
      visibleEvents += revealedEventCount(p.events, time);
    }
  }

  return { time, duration, speed, visiblePlayers, totalPlayers, visibleEvents, totalEvents };
}
