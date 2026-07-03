import { describe, expect, it } from 'vitest';
import type { Aggregate, Match, PathPoint } from '../types/contract';
import { aggregateStats, matchStats } from './stats';

const match = {
  matchId: 'm',
  mapId: 'GrandRift',
  date: '2026-02-10',
  startTs: 0,
  endTs: 500,
  players: [
    {
      userId: 'a',
      isBot: false,
      path: [[0, 1, 1], [10, 2, 2], [20, 3, 3]] as PathPoint[],
      events: [
        { t: 5, cat: 'kill', raw: 'Kill', px: 1, py: 1 },
        { t: 8, cat: 'loot', raw: 'Loot', px: 2, py: 2 },
      ],
    },
    {
      userId: 'b',
      isBot: true,
      path: [[0, 5, 5]] as PathPoint[],
      events: [{ t: 9, cat: 'death', raw: 'BotKilled', px: 5, py: 5 }],
    },
  ],
} as unknown as Match;

describe('matchStats', () => {
  const s = matchStats(match);
  it('counts players and human/bot split', () => {
    expect(s.players).toBe(2);
    expect(s.humans).toBe(1);
    expect(s.bots).toBe(1);
  });
  it('sums path points across players', () => {
    expect(s.points).toBe(4); // 3 + 1
  });
  it('takes duration from endTs', () => {
    expect(s.durationMs).toBe(500);
  });
  it('breaks events down by category with a correct total', () => {
    expect(s.events).toEqual({ kill: 1, death: 1, loot: 1, storm: 0 });
    expect(s.totalEvents).toBe(3);
  });
});

describe('aggregateStats', () => {
  const agg: Aggregate = {
    mapId: 'GrandRift',
    date: '2026-02-10',
    points: [
      [1, 1],
      [2, 2],
      [3, 3],
    ],
    events: [
      { cat: 'kill', px: 1, py: 1 },
      { cat: 'kill', px: 2, py: 2 },
      { cat: 'storm', px: 3, py: 3 },
    ],
  };
  const s = aggregateStats(agg);
  it('counts points', () => {
    expect(s.points).toBe(3);
  });
  it('breaks events down by category with a correct total', () => {
    expect(s.events).toEqual({ kill: 2, death: 0, loot: 0, storm: 1 });
    expect(s.totalEvents).toBe(3);
  });
});
