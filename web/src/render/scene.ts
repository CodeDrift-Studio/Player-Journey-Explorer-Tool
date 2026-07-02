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

import { pixelToScreen, type ViewTransform } from '../lib/viewport';
import type { LayerKey } from '../store/filterStore';
import type { Aggregate, EventCategory, Match } from '../types/contract';
import { COLORS } from './palette';

const GRID_DIVISIONS = 8;
const MARKER_R = 4; // event marker radius, in screen px (constant size)

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
}

export function renderScene(a: SceneArgs): void {
  const { ctx, width, height, size, transform, image, match, aggregate, layers } = a;

  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, width, height);

  if (image) drawMinimap(ctx, image, size, transform);
  else drawGrid(ctx, size, transform);
  drawFrame(ctx, size, transform);

  if (match) {
    if (layers.paths) drawPaths(ctx, match, transform, layers);
    if (layers.events) drawMatchEvents(ctx, match, transform, layers);
  } else if (aggregate) {
    if (layers.paths) drawAggPoints(ctx, aggregate, transform);
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

function drawPaths(ctx: Ctx, match: Match, t: ViewTransform, layers: Layers): void {
  for (const p of match.players) {
    if (p.isBot && !layers.bots) continue;
    if (!p.isBot && !layers.humans) continue;
    if (p.path.length === 0) continue;

    const color = p.isBot ? COLORS.bot : COLORS.human;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = p.isBot ? 0.5 : 0.9;
    ctx.lineWidth = p.isBot ? 1 : 1.5;

    // A single-sample player has no line to draw — show a dot so they're visible.
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
  }
  ctx.globalAlpha = 1;
}

function drawMatchEvents(ctx: Ctx, match: Match, t: ViewTransform, layers: Layers): void {
  for (const p of match.players) {
    if (p.isBot && !layers.bots) continue;
    if (!p.isBot && !layers.humans) continue;
    for (const e of p.events) {
      const [sx, sy] = pixelToScreen(e.px, e.py, t);
      drawMarker(ctx, e.cat, sx, sy);
    }
  }
}

function drawAggPoints(ctx: Ctx, agg: Aggregate, t: ViewTransform): void {
  // Faint dots convey density (a lightweight precursor to the heatmap layer).
  ctx.fillStyle = COLORS.human;
  ctx.globalAlpha = 0.25;
  for (const [px, py] of agg.points) {
    const [sx, sy] = pixelToScreen(px, py, t);
    ctx.fillRect(sx - 0.5, sy - 0.5, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
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
