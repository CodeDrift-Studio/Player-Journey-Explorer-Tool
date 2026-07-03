/**
 * Pure marker hit-testing — no React, no canvas. Finds the event marker nearest a
 * cursor position so the viewport can show a tooltip. Works in minimap-pixel space:
 * the caller converts the screen cursor via screenToPixel and passes a radius already
 * divided by the view scale, so hit distance is constant in *screen* pixels
 * regardless of zoom. Honors the same visibility rules the renderer uses (layer
 * toggles + playback time), so hover always matches what's actually drawn.
 */

import type { EventCategory, Match } from '../types/contract';

export interface EventHit {
  raw: string;
  cat: EventCategory;
  t: number;
  px: number;
  py: number;
  isBot: boolean;
  userId: string;
}

export interface HitFilter {
  /** Only events with t <= time are hittable; null = no time gating. */
  time: number | null;
  humans: boolean;
  bots: boolean;
  events: boolean;
}

/**
 * Nearest event marker within `radiusPx` (minimap-pixel space) of (px, py), or null.
 * Ties/overlaps resolve to the closest; equal distance keeps the first found.
 */
export function findEventAtPixel(
  match: Match,
  px: number,
  py: number,
  radiusPx: number,
  f: HitFilter,
): EventHit | null {
  if (!f.events) return null;
  let best: EventHit | null = null;
  let bestD2 = radiusPx * radiusPx;
  for (const p of match.players) {
    if (p.isBot && !f.bots) continue;
    if (!p.isBot && !f.humans) continue;
    for (const e of p.events) {
      if (f.time !== null && e.t > f.time) continue;
      const dx = e.px - px;
      const dy = e.py - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { raw: e.raw, cat: e.cat, t: e.t, px: e.px, py: e.py, isBot: p.isBot, userId: p.userId };
      }
    }
  }
  return best;
}
