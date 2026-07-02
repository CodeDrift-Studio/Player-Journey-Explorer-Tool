/**
 * Invert the minimap-pixel projection back to WORLD coordinates.
 *
 * The ETL ships pixels (0..size), but level designers think in world units
 * (the x,z they place objects at). We can recover world coords on the client
 * because the manifest carries each map's projection config — so we never had
 * to ship world coords redundantly.
 *
 * Inverse of coordinates.py:  px = u*size, py = (1-v)*size,
 *                             u = (x-originX)/scale, v = (z-originZ)/scale
 */

import type { MapConfig } from '../types/contract';

export function pixelToWorld(px: number, py: number, cfg: MapConfig): [number, number] {
  const u = px / cfg.size;
  const v = 1 - py / cfg.size; // undo the Y-flip
  const worldX = cfg.originX + u * cfg.scale;
  const worldZ = cfg.originZ + v * cfg.scale;
  return [worldX, worldZ];
}
