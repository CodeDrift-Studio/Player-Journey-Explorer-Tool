import { describe, expect, it } from 'vitest';
import type { Aggregate } from '../types/contract';
import { blurGrid, buildDensityGrid, heatmapPoints } from './heatmap';

const agg: Aggregate = {
  mapId: 'GrandRift',
  date: '2026-02-10',
  points: [
    [10, 10],
    [12, 11],
    [900, 900],
  ],
  events: [
    { cat: 'kill', px: 100, py: 100 },
    { cat: 'kill', px: 105, py: 105 },
    { cat: 'loot', px: 500, py: 500 },
  ],
};

describe('heatmapPoints', () => {
  it('returns all movement points for traffic', () => {
    expect(heatmapPoints(agg, 'traffic')).toHaveLength(3);
  });
  it('returns only events of the requested category', () => {
    expect(heatmapPoints(agg, 'kill')).toEqual([
      [100, 100],
      [105, 105],
    ]);
    expect(heatmapPoints(agg, 'loot')).toEqual([[500, 500]]);
    expect(heatmapPoints(agg, 'death')).toEqual([]);
  });
});

describe('buildDensityGrid', () => {
  it('bins points into a size/binPx square grid', () => {
    const g = buildDensityGrid(agg.points, 1000, 100); // 10×10 grid
    expect(g.cols).toBe(10);
    expect(g.rows).toBe(10);
    // (10,10) and (12,11) fall in bin (0,0); (900,900) in bin (9,9).
    expect(g.grid[0]).toBe(2);
    expect(g.grid[9 * 10 + 9]).toBe(1);
    expect(g.max).toBe(2);
  });
  it('clamps out-of-range (unclamped) coordinates into the edge bins', () => {
    const g = buildDensityGrid([[-50, -50], [2000, 2000]], 1000, 100);
    expect(g.grid[0]).toBe(1); // negative → bin (0,0)
    expect(g.grid[g.cols * g.rows - 1]).toBe(1); // beyond size → last bin
    expect(g.max).toBe(1);
  });
  it('produces an all-zero grid (max 0) for no points', () => {
    const g = buildDensityGrid([], 1000, 100);
    expect(g.max).toBe(0);
    expect(g.grid.every((v) => v === 0)).toBe(true);
  });
});

describe('blurGrid', () => {
  it('spreads a single spike to its neighbors while lowering the peak', () => {
    const base = buildDensityGrid([[500, 500]], 1000, 100); // one spike, max 1
    const blurred = blurGrid(base, 1);
    // Peak reduced by the [1,2,1]/4 kernel (both axes), neighbors now non-zero.
    expect(blurred.max).toBeLessThan(1);
    expect(blurred.max).toBeGreaterThan(0);
    const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);
    // A [1,2,1]/4 separable blur conserves total mass (edge-clamped, spike interior).
    expect(sum(blurred.grid)).toBeCloseTo(sum(base.grid), 5);
  });
  it('is a no-op shape-wise (same dimensions)', () => {
    const base = buildDensityGrid(agg.points, 1000, 100);
    const blurred = blurGrid(base, 2);
    expect(blurred.cols).toBe(base.cols);
    expect(blurred.rows).toBe(base.rows);
    expect(blurred.grid.length).toBe(base.grid.length);
  });
});
