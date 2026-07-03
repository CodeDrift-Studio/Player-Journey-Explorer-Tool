/**
 * Pure per-selection statistics — no React, no canvas. Derives the numbers the
 * StatsPanel shows straight from the loaded Match / Aggregate, so the component is
 * a thin presenter and the counting is unit-testable in isolation.
 */

import type { Aggregate, EventCategory, Match } from '../types/contract';

export const EVENT_CATEGORIES: readonly EventCategory[] = ['kill', 'death', 'loot', 'storm'];

export type EventBreakdown = Record<EventCategory, number>;

function emptyBreakdown(): EventBreakdown {
  return { kill: 0, death: 0, loot: 0, storm: 0 };
}

export interface MatchStats {
  players: number;
  humans: number;
  bots: number;
  points: number;
  durationMs: number;
  events: EventBreakdown;
  totalEvents: number;
}

export function matchStats(m: Match): MatchStats {
  let humans = 0;
  let bots = 0;
  let points = 0;
  let totalEvents = 0;
  const events = emptyBreakdown();
  for (const p of m.players) {
    if (p.isBot) bots++;
    else humans++;
    points += p.path.length;
    for (const e of p.events) {
      events[e.cat]++;
      totalEvents++;
    }
  }
  return { players: m.players.length, humans, bots, points, durationMs: m.endTs, events, totalEvents };
}

export interface AggregateStats {
  points: number;
  events: EventBreakdown;
  totalEvents: number;
}

export function aggregateStats(a: Aggregate): AggregateStats {
  const events = emptyBreakdown();
  for (const e of a.events) events[e.cat]++;
  return { points: a.points.length, events, totalEvents: a.events.length };
}
