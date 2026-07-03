/**
 * Canvas scene renderer — pure drawing, no React, no state.
 *
 * renderScene() composes the layers in back-to-front order:
 *   background → minimap (or grid placeholder) → frame → paths/points → events.
 *
 * All geometry goes through pixelToScreen(), so the minimap image and the data
 * share one coordinate space and are guaranteed to align. Every helper takes the
 * context + params and draws — trivially reasoned about, easy to extend.
 */

import { blurGrid, buildDensityGrid, heatmapPoints, type HeatmapMode } from '../lib/heatmap';
import { pathHead } from '../lib/playback';
import { pixelToScreen, type ViewTransform } from '../lib/viewport';
import type { LayerKey } from '../store/filterStore';
import type { Aggregate, EventCategory, Match } from '../types/contract';
import { COLORS, heatColor } from './palette';

const GRID_DIVISIONS = 8;
const MARKER_R = 4; // event marker radius, in screen px (constant size)
const HEAD_R = 2.75; // playback "current position" dot radius, screen px
const HEATMAP_BIN_PX = 12; // density bin size in minimap px (~86×86 grid over 1024)

type Ctx = CanvasRenderingContext2D;
type Layers = Record<LayerKey, boolean>;

export interface SceneArgs {
  ctx: Ctx;
  width: number;
  height: number;
  size: number; // map size (1024)
  transform: ViewTransform;
  image: HTMLImageElement | null;
  match: Match | null;
  aggregate: Aggregate | null;
  layers: Layers;
  /**
   * Playback position in telemetry ms. When a number, paths reveal progressively
   * up to `time` (with an interpolated head) and only events with `t <= time`
   * draw. When null (aggregate view, or playback not applicable) the whole match
   * draws — behavior identical to before playback existed.
   */
  time: number | null;
  /** Which density the aggregate/overview heatmap shows (ignored in match mode). */
  heatmapMode: HeatmapMode;
}

export function renderScene(a: SceneArgs): void {
  const { ctx, width, height, size, transform, image, match, aggregate, layers, time, heatmapMode } = a;

  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, width, height);

  if (image) drawMinimap(ctx, image, size, transform);
  else drawGrid(ctx, size, transform);
  drawFrame(ctx, size, transform);

  if (match) {
    if (layers.paths) drawPaths(ctx, match, transform, layers, time);
    if (layers.events) drawMatchEvents(ctx, match, transform, layers, time);
  } else if (aggregate) {
    drawHeatmap(ctx, aggregate, transform, size, heatmapMode);
    if (layers.events) drawAggEvents(ctx, aggregate, transform);
  }
}

function drawMinimap(ctx: Ctx, img: HTMLImageElement, size: number, t: ViewTransform): void {
  const [x0, y0] = pixelToScreen(0, 0, t);
  const [x1, y1] = pixelToScreen(size, size, t);
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
}

function drawFrame(ctx: Ctx, size: number, t: ViewTransform): void {
  const [x0, y0] = pixelToScreen(0, 0, t);
  const [x1, y1] = pixelToScreen(size, size, t);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0));
}

function drawGrid(ctx: Ctx, size: number, t: ViewTransform): void {
  const [x0, y0] = pixelToScreen(0, 0, t);
  const [x1, y1] = pixelToScreen(size, size, t);
  ctx.strokeStyle = 'rgba(148,163,184,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = size / GRID_DIVISIONS;
  for (let g = step; g < size; g += step) {
    const [gx] = pixelToScreen(g, 0, t);
    ctx.moveTo(Math.round(gx) + 0.5, y0);
    ctx.lineTo(Math.round(gx) + 0.5, y1);
    const [, gy] = pixelToScreen(0, g, t);
    ctx.moveTo(x0, Math.round(gy) + 0.5);
    ctx.lineTo(x1, Math.round(gy) + 0.5);
  }
  ctx.stroke();
}

function drawPaths(
  ctx: Ctx,
  match: Match,
  t: ViewTransform,
  layers: Layers,
  time: number | null,
): void {
  for (const p of match.players) {
    if (p.isBot && !layers.bots) continue;
    if (!p.isBot && !layers.humans) continue;
    if (p.path.length === 0) continue;

    const color = p.isBot ? COLORS.bot : COLORS.human;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = p.isBot ? 0.5 : 0.9;
    ctx.lineWidth = p.isBot ? 1 : 1.5;

    // Static (whole-match) rendering — playback disabled / aggregate.
    if (time === null) {
      if (p.path.length === 1) {
        const [sx, sy] = pixelToScreen(p.path[0][1], p.path[0][2], t);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      const [sx0, sy0] = pixelToScreen(p.path[0][1], p.path[0][2], t);
      ctx.moveTo(sx0, sy0);
      for (let i = 1; i < p.path.length; i++) {
        const [sx, sy] = pixelToScreen(p.path[i][1], p.path[i][2], t);
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      continue;
    }

    // Progressive playback: reveal [0..head.index] plus a partial segment to the
    // interpolated head position, and mark the head with a dot.
    const head = pathHead(p.path, time);
    if (!head) continue; // player hasn't appeared yet at this time

    ctx.beginPath();
    const [sx0, sy0] = pixelToScreen(p.path[0][1], p.path[0][2], t);
    ctx.moveTo(sx0, sy0);
    for (let i = 1; i <= head.index; i++) {
      const [sx, sy] = pixelToScreen(p.path[i][1], p.path[i][2], t);
      ctx.lineTo(sx, sy);
    }
    const [hx, hy] = pixelToScreen(head.px, head.py, t);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Head dot sits exactly on the interpolated position.
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = p.isBot ? 0.5 : 0.9;
  }
  ctx.globalAlpha = 1;
}

function drawMatchEvents(
  ctx: Ctx,
  match: Match,
  t: ViewTransform,
  layers: Layers,
  time: number | null,
): void {
  for (const p of match.players) {
    if (p.isBot && !layers.bots) continue;
    if (!p.isBot && !layers.humans) continue;
    for (const e of p.events) {
      if (time !== null && e.t > time) continue; // not yet occurred at this time
      const [sx, sy] = pixelToScreen(e.px, e.py, t);
      drawMarker(ctx, e.cat, sx, sy);
    }
  }
}

/**
 * Aggregate density heatmap. Bins the mode's points (traffic movement, or
 * kill/death/loot event positions) into a coarse minimap-pixel grid, smooths it,
 * normalizes, and paints one texel per bin into a small offscreen canvas — then
 * blits it scaled over the map rect with smoothing for a soft field. The grid is
 * in pixel space (independent of zoom/pan), so it aligns with the minimap and the
 * blit follows the current transform.
 */
function drawHeatmap(ctx: Ctx, agg: Aggregate, t: ViewTransform, size: number, mode: HeatmapMode): void {
  const pts = heatmapPoints(agg, mode);
  if (pts.length === 0) return;
  const g = blurGrid(buildDensityGrid(pts, size, HEATMAP_BIN_PX), 1);
  if (g.max <= 0) return;

  const off = document.createElement('canvas');
  off.width = g.cols;
  off.height = g.rows;
  const octx = off.getContext('2d');
  if (!octx) return;
  const img = octx.createImageData(g.cols, g.rows);
  for (let i = 0; i < g.grid.length; i++) {
    const [r, gg, b, a] = heatColor(mode, g.grid[i] / g.max);
    const j = i * 4;
    img.data[j] = r;
    img.data[j + 1] = gg;
    img.data[j + 2] = b;
    img.data[j + 3] = a;
  }
  octx.putImageData(img, 0, 0);

  const [x0, y0] = pixelToScreen(0, 0, t);
  const [x1, y1] = pixelToScreen(size, size, t);
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, x0, y0, x1 - x0, y1 - y0);
  ctx.imageSmoothingEnabled = prevSmoothing;
}

function drawAggEvents(ctx: Ctx, agg: Aggregate, t: ViewTransform): void {
  for (const e of agg.events) {
    const [sx, sy] = pixelToScreen(e.px, e.py, t);
    drawMarker(ctx, e.cat, sx, sy);
  }
}

/** Distinct glyph per category: kill=✕, death=✚, loot=◆, storm=▲. */
function drawMarker(ctx: Ctx, cat: EventCategory, x: number, y: number): void {
  const color = COLORS.event[cat];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  const r = MARKER_R;
  ctx.beginPath();
  switch (cat) {
    case 'kill': // ✕
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
      break;
    case 'death': // ✚
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
      break;
    case 'loot': // ◆
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'storm': // ▲
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x - r, y + r);
      ctx.closePath();
      ctx.fill();
      break;
  }
}
