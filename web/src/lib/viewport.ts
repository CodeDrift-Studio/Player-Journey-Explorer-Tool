/**
 * Pure viewport transform math: map "minimap-pixel space" (0..size) to screen
 * (CSS) pixels and back. No React, no canvas — just numbers, so it's trivially
 * testable and reused by both drawing and hit-testing (cursor readout).
 */

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Fit a `size`×`size` square into a (width,height) box with uniform scale,
 * centered, leaving `padding` px around it. Uniform scale keeps the map's aspect
 * ratio square (no distortion).
 */
export function fitTransform(
  width: number,
  height: number,
  size: number,
  padding = 16,
): ViewTransform {
  const usableW = Math.max(1, width - padding * 2);
  const usableH = Math.max(1, height - padding * 2);
  const scale = Math.min(usableW, usableH) / size;
  const drawn = size * scale;
  return {
    scale,
    offsetX: (width - drawn) / 2,
    offsetY: (height - drawn) / 2,
  };
}

/** Minimap-pixel coord -> screen (CSS) coord. */
export function pixelToScreen(px: number, py: number, t: ViewTransform): [number, number] {
  return [t.offsetX + px * t.scale, t.offsetY + py * t.scale];
}

/** Screen (CSS) coord -> minimap-pixel coord (for the cursor readout). */
export function screenToPixel(sx: number, sy: number, t: ViewTransform): [number, number] {
  return [(sx - t.offsetX) / t.scale, (sy - t.offsetY) / t.scale];
}

export const MIN_ZOOM = 1; // 1 = fit-to-view (can't zoom out past the whole map)
export const MAX_ZOOM = 12;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * User view = a `zoom` (about the viewport center) plus a `pan` (screen px)
 * layered on top of the base fit. Composing here — rather than mutating a free
 * affine — means a resize just recomputes the fit and the user's zoom/pan
 * re-apply cleanly, with no drift.
 */
export function applyView(
  fit: ViewTransform,
  zoom: number,
  panX: number,
  panY: number,
  width: number,
  height: number,
): ViewTransform {
  const cx = width / 2;
  const cy = height / 2;
  return {
    scale: fit.scale * zoom,
    offsetX: cx * (1 - zoom) + zoom * fit.offsetX + panX,
    offsetY: cy * (1 - zoom) + zoom * fit.offsetY + panY,
  };
}

/**
 * Clamp pan so the map can't drift off-screen: when the scaled map is larger
 * than the viewport it may pan until an edge meets the viewport edge (no gap on
 * the far side); when it fits, it's locked centered.
 */
export function clampPan(
  fit: ViewTransform,
  zoom: number,
  size: number,
  width: number,
  height: number,
  panX: number,
  panY: number,
): [number, number] {
  const t0 = applyView(fit, zoom, 0, 0, width, height); // pan = 0 reference
  const [l, top] = pixelToScreen(0, 0, t0);
  const [r, bottom] = pixelToScreen(size, size, t0);
  return [axisClamp(l, r, width, panX), axisClamp(top, bottom, height, panY)];
}

function axisClamp(near: number, far: number, extent: number, pan: number): number {
  const scaled = far - near;
  if (scaled <= extent) return (extent - scaled) / 2 - near; // fits: lock centered
  return clamp(pan, extent - far, -near); // overflows: keep it covering the viewport
}
