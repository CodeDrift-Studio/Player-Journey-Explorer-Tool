import { describe, expect, it } from 'vitest';
import type { Match, PathPoint } from '../types/contract';
import {
  advanceTime,
  clampTime,
  computePlaybackStats,
  pathHead,
  playbackRate,
  PLAYBACK_FULL_WALL_MS,
  revealedEventCount,
  revealedIndex,
} from './playback';

// A path with samples at ts = 0, 100, 300 (irregular gaps, like real telemetry).
const PATH: PathPoint[] = [
  [0, 10, 20],
  [100, 30, 20],
  [300, 30, 60],
];

describe('clampTime', () => {
  it('clamps into [0, duration]', () => {
    expect(clampTime(-5, 100)).toBe(0);
    expect(clampTime(50, 100)).toBe(50);
    expect(clampTime(150, 100)).toBe(100);
  });
  it('returns 0 when there is no timeline or input is not finite', () => {
    expect(clampTime(50, 0)).toBe(0);
    expect(clampTime(NaN, 100)).toBe(0);
    expect(clampTime(Infinity, 100)).toBe(0);
  });
});

describe('playbackRate', () => {
  it('is 0 when there is no timeline', () => {
    expect(playbackRate(0, 1)).toBe(0);
  });
  it('scales with speed and plays a full match in FULL_WALL_MS/speed', () => {
    const duration = 800;
    const rate1 = playbackRate(duration, 1);
    // At 1x, FULL_WALL_MS of wall time should cover the whole duration.
    expect(rate1 * PLAYBACK_FULL_WALL_MS).toBeCloseTo(duration);
    // 2x is exactly twice as fast.
    expect(playbackRate(duration, 2)).toBeCloseTo(rate1 * 2);
  });
});

describe('advanceTime', () => {
  it('advances by wallDt * rate', () => {
    const r = advanceTime(0, 100, 2, 1000);
    expect(r).toEqual({ time: 200, ended: false });
  });
  it('clamps to duration and reports ended at the end', () => {
    const r = advanceTime(900, 100, 2, 1000);
    expect(r.time).toBe(1000);
    expect(r.ended).toBe(true);
  });
  it('never goes below 0', () => {
    expect(advanceTime(10, 100, -1, 1000).time).toBe(0);
  });
  it('reports ended immediately when there is no timeline', () => {
    expect(advanceTime(0, 16, 1, 0)).toEqual({ time: 0, ended: true });
  });
  it('a full 1x run reaches the end in one FULL_WALL_MS step', () => {
    const duration = 500;
    const rate = playbackRate(duration, 1);
    expect(advanceTime(0, PLAYBACK_FULL_WALL_MS, rate, duration)).toEqual({
      time: duration,
      ended: true,
    });
  });
});

describe('revealedIndex (binary search)', () => {
  it('returns -1 before the first sample', () => {
    expect(revealedIndex(PATH, -1)).toBe(-1);
  });
  it('finds the last index with ts <= time', () => {
    expect(revealedIndex(PATH, 0)).toBe(0);
    expect(revealedIndex(PATH, 99)).toBe(0);
    expect(revealedIndex(PATH, 100)).toBe(1);
    expect(revealedIndex(PATH, 299)).toBe(1);
    expect(revealedIndex(PATH, 300)).toBe(2);
    expect(revealedIndex(PATH, 5000)).toBe(2);
  });
  it('handles the empty path', () => {
    expect(revealedIndex([], 10)).toBe(-1);
  });
});

describe('pathHead (partial-segment interpolation)', () => {
  it('is null before the player appears', () => {
    expect(pathHead(PATH, -1)).toBeNull();
  });
  it('sits on a sample exactly at its ts', () => {
    expect(pathHead(PATH, 0)).toEqual({ index: 0, px: 10, py: 20 });
    expect(pathHead(PATH, 100)).toEqual({ index: 1, px: 30, py: 20 });
  });
  it('interpolates linearly between samples', () => {
    // Halfway through segment [0..100]: x goes 10 -> 30, so 20.
    const h = pathHead(PATH, 50);
    expect(h?.index).toBe(0);
    expect(h?.px).toBeCloseTo(20);
    expect(h?.py).toBeCloseTo(20);
    // 25% into segment [100..300]: y goes 20 -> 60, so 30.
    const h2 = pathHead(PATH, 150);
    expect(h2?.index).toBe(1);
    expect(h2?.px).toBeCloseTo(30);
    expect(h2?.py).toBeCloseTo(30);
  });
  it('holds at the final sample past the end (no next segment)', () => {
    expect(pathHead(PATH, 1000)).toEqual({ index: 2, px: 30, py: 60 });
  });
});

describe('revealedEventCount', () => {
  const events = [{ t: 10 }, { t: 50 }, { t: 50 }, { t: 400 }];
  it('counts events with t <= time (inclusive)', () => {
    expect(revealedEventCount(events, 0)).toBe(0);
    expect(revealedEventCount(events, 50)).toBe(3);
    expect(revealedEventCount(events, 399)).toBe(3);
    expect(revealedEventCount(events, 400)).toBe(4);
  });
});

describe('computePlaybackStats', () => {
  const match = {
    matchId: 'm',
    mapId: 'GrandRift',
    date: '2026-02-10',
    startTs: 0,
    endTs: 300,
    players: [
      { userId: 'a', isBot: false, path: PATH, events: [{ t: 20 }, { t: 250 }] },
      { userId: 'b', isBot: true, path: [[200, 5, 5]] as PathPoint[], events: [] },
    ],
  } as unknown as Match;

  it('returns zeroed stats for a null match', () => {
    expect(computePlaybackStats(null, 100, 300, 1)).toMatchObject({
      visiblePlayers: 0,
      totalPlayers: 0,
      visibleEvents: 0,
      totalEvents: 0,
    });
  });

  it('counts revealed players and events at a given time', () => {
    // t=100: player a is revealed (path starts at 0); player b not yet (starts 200).
    const s = computePlaybackStats(match, 100, 300, 1);
    expect(s.totalPlayers).toBe(2);
    expect(s.visiblePlayers).toBe(1);
    expect(s.totalEvents).toBe(2);
    expect(s.visibleEvents).toBe(1); // only the t=20 event
    expect(s.time).toBe(100);
    expect(s.duration).toBe(300);
    expect(s.speed).toBe(1);
  });

  it('reveals both players and all events by the end', () => {
    const s = computePlaybackStats(match, 300, 300, 2);
    expect(s.visiblePlayers).toBe(2);
    expect(s.visibleEvents).toBe(2);
    expect(s.speed).toBe(2);
  });
});
