/**
 * The visualization's color language — single source of truth, shared by the
 * canvas renderer and (later) the Legend so they can never drift apart.
 *
 * Humans pop (bright blue); bots recede (muted slate) — level designers care
 * primarily about human behaviour. Event colors are chosen to be mutually
 * distinct and to stand out against both path colors.
 */

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
