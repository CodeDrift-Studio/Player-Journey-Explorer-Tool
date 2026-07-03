import { describe, expect, it } from 'vitest';
import type { Match, PathPoint } from '../types/contract';
import { findEventAtPixel } from './hitTest';

const match = {
  matchId: 'm',
  mapId: 'GrandRift',
  date: '2026-02-10',
  startTs: 0,
  endTs: 500,
  players: [
    {
      userId: 'human1',
      isBot: false,
      path: [[0, 0, 0]] as PathPoint[],
      events: [
        { t: 100, cat: 'kill', raw: 'Kill', px: 100, py: 100 },
        { t: 400, cat: 'loot', raw: 'Loot', px: 300, py: 300 },
      ],
    },
    {
      userId: 'bot1',
      isBot: true,
      path: [[0, 0, 0]] as PathPoint[],
      events: [{ t: 200, cat: 'death', raw: 'BotKilled', px: 105, py: 104 }],
    },
  ],
} as unknown as Match;

const allOn = { time: null, humans: true, bots: true, events: true };

describe('findEventAtPixel', () => {
  it('returns null when nothing is within the radius', () => {
    expect(findEventAtPixel(match, 500, 500, 8, allOn)).toBeNull();
  });
  it('finds the event under the cursor', () => {
    const hit = findEventAtPixel(match, 300, 301, 8, allOn);
    expect(hit?.raw).toBe('Loot');
    expect(hit?.cat).toBe('loot');
    expect(hit?.userId).toBe('human1');
  });
  it('returns the nearest when several are in range', () => {
    // (102,102): kill at (100,100) d²=8 vs bot death at (105,104) d²=13 → kill wins.
    expect(findEventAtPixel(match, 102, 102, 20, allOn)?.raw).toBe('Kill');
  });
  it('respects the layer filters', () => {
    // Near the bot death only; bots off → no hit.
    expect(findEventAtPixel(match, 105, 104, 3, { ...allOn, bots: false })).toBeNull();
    expect(findEventAtPixel(match, 105, 104, 3, { ...allOn, bots: false, humans: true })?.raw ?? null).toBeNull();
    expect(findEventAtPixel(match, 100, 100, 30, allOn)).not.toBeNull();
    expect(findEventAtPixel(match, 100, 100, 30, { ...allOn, events: false })).toBeNull();
  });
  it('gates on playback time (only revealed events are hittable)', () => {
    // Loot at t=400: not yet at time=200, hittable by time=400.
    expect(findEventAtPixel(match, 300, 300, 8, { ...allOn, time: 200 })).toBeNull();
    expect(findEventAtPixel(match, 300, 300, 8, { ...allOn, time: 400 })?.raw).toBe('Loot');
  });
});
