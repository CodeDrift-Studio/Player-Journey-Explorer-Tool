/**
 * Pure aggregate-density logic — no React, no canvas. Turns a map/day Aggregate
 * into a normalized density grid the renderer can paint as a heatmap, and answers
 * "which points feed which density mode". Kept pure so it's unit-testable and the
 * renderer stays a thin painter.
 *
 * The assignment calls for Kill / Death / Loot / Traffic density. "Traffic" is the
 * flattened movement points; the event modes are event positions of that category.
 */

import type { Aggregate, EventCategory } from '../types/contract';

export type HeatmapMode = 'traffic' | 'kill' | 'death' | 'loot';

/** Ordered, labelled modes for the UI selector. */
export const HEATMAP_MODES: ReadonlyArray<{ key: HeatmapMode; label: string }> = [
  { key: 'traffic', label: 'Traffic' },
  { key: 'kill', label: 'Kills' },
  { key: 'death', label: 'Deaths' },
  { key: 'loot', label: 'Loot' },
];

/**
 * The minimap-pixel points feeding a mode: all movement samples for `traffic`,
 * otherwise the positions of events of that category.
 */
export function heatmapPoints(agg: Aggregate, mode: HeatmapMode): Array<readonly [number, number]> {
  if (mode === 'traffic') return agg.points;
  const cat = mode as EventCategory;
  const out: Array<readonly [number, number]> = [];
  for (const e of agg.events) if (e.cat === cat) out.push([e.px, e.py]);
  return out;
}

export interface DensityGrid {
  grid: Float32Array; // row-major cols*rows counts
  cols: number;
  rows: number;
  max: number;
}

/**
 * Bin points (minimap-pixel space, 0..size, square map) into a coarse count grid.
 * Coordinates are unclamped by design (off-map points are real signal), so bin
 * indices are clamped into range — an off-map point contributes at the edge.
 */
export function buildDensityGrid(
  points: ReadonlyArray<readonly [number, number]>,
  size: number,
  binPx: number,
): DensityGrid {
  const cols = Math.max(1, Math.ceil(size / binPx));
  const rows = cols;
  const grid = new Float32Array(cols * rows);
  const clampIdx = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  for (const [px, py] of points) {
    const cx = clampIdx(Math.floor((px / size) * cols), cols);
    const cy = clampIdx(Math.floor((py / size) * rows), rows);
    grid[cy * cols + cx] += 1;
  }
  return { grid, cols, rows, max: gridMax(grid) };
}

function gridMax(grid: Float32Array): number {
  let max = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  return max;
}

/** Separable 3-tap [1,2,1] box blur with edge clamp — smooths the binned field. */
export function blurGrid(g: DensityGrid, passes = 1): DensityGrid {
  let grid = g.grid;
  const { cols, rows } = g;
  for (let p = 0; p < passes; p++) {
    grid = blur1D(grid, cols, rows, true);
    grid = blur1D(grid, cols, rows, false);
  }
  return { grid, cols, rows, max: gridMax(grid) };
}

function blur1D(src: Float32Array, cols: number, rows: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let a: number, c: number;
      if (horizontal) {
        a = src[y * cols + (x > 0 ? x - 1 : 0)];
        c = src[y * cols + (x < cols - 1 ? x + 1 : cols - 1)];
      } else {
        a = src[(y > 0 ? y - 1 : 0) * cols + x];
        c = src[(y < rows - 1 ? y + 1 : rows - 1) * cols + x];
      }
      out[i] = (a + 2 * src[i] + c) / 4;
    }
  }
  return out;
}
