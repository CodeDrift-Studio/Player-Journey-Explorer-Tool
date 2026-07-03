/**
 * The visualization's color language — single source of truth, shared by the
 * canvas renderer and (later) the Legend so they can never drift apart.
 *
 * Humans pop (bright blue); bots recede (muted slate) — level designers care
 * primarily about human behaviour. Event colors are chosen to be mutually
 * distinct and to stand out against both path colors.
 */

import type { HeatmapMode } from '../lib/heatmap';
import type { EventCategory } from '../types/contract';

export const COLORS = {
  human: '#60a5fa', // blue-400 — bright, foreground
  bot: '#94a3b8', // slate-400 — muted, background actors
  event: {
    kill: '#ef4444', // red-500
    death: '#c084fc', // purple-400
    loot: '#facc15', // yellow-400
    storm: '#2dd4bf', // teal-400
  } satisfies Record<EventCategory, string>,
} as const;

/**
 * Base RGB per heatmap mode — reuses the path/event language so the density field
 * reads consistently (traffic = human blue; kills/deaths/loot = their marker hues).
 */
export const HEATMAP_BASE: Record<HeatmapMode, readonly [number, number, number]> = {
  traffic: [96, 165, 250], // blue-400
  kill: [239, 68, 68], // red-500
  death: [192, 132, 252], // purple-400
  loot: [250, 204, 21], // yellow-400
} as const;

/**
 * Normalized density `t` (0..1) → RGBA for a mode. Low density is a faint tint of
 * the base hue; hotspots brighten toward white. A gamma on alpha (t^0.6) lifts
 * mid-range density so the field isn't dominated by a single peak.
 */
export function heatColor(mode: HeatmapMode, t: number): [number, number, number, number] {
  const [r, g, b] = HEATMAP_BASE[mode];
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const boost = k * 0.55; // lighten hotspots toward white
  const alpha = Math.pow(k, 0.6) * 0.85;
  return [
    Math.round(r + (255 - r) * boost),
    Math.round(g + (255 - g) * boost),
    Math.round(b + (255 - b) * boost),
    Math.round(alpha * 255),
  ];
}
