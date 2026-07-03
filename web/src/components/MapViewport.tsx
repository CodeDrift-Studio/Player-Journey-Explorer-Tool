/**
 * The Canvas map viewport.
 *
 * Owns the <canvas>: HiDPI-correct backing store, resize handling, minimap image
 * loading, and full-scene redraws. Redraws happen ON DEMAND — when the view size,
 * data, layers, image, map size, or the user's zoom/pan change — coalesced through
 * a single rAF.
 *
 * Interaction: wheel zooms toward the cursor (the point under the pointer stays
 * fixed) and drag pans. Both feed a local view state ({zoom, panX, panY}) that is
 * composed with the fit transform in lib/viewport. The cursor readout reports
 * WORLD coordinates (the units designers work in), inverted from pixels.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useImage } from '../hooks/useImage';
import { pixelToWorld } from '../lib/mapCoords';
import {
  applyView,
  clamp,
  clampPan,
  fitTransform,
  MAX_ZOOM,
  MIN_ZOOM,
  screenToPixel,
  type ViewTransform,
} from '../lib/viewport';
import { advanceTime, playbackRate } from '../lib/playback';
import { renderScene } from '../render/scene';
import { useDataStore } from '../store/dataStore';
import { useFilterStore } from '../store/filterStore';
import { usePlaybackStore } from '../store/playbackStore';
import { Legend } from './Legend';

const DEFAULT_SIZE = 1024;
const ZOOM_WHEEL_SENSITIVITY = 0.0015; // per wheel delta unit
const IDENTITY_VIEW: View = { zoom: 1, panX: 0, panY: 0 };

interface View {
  zoom: number;
  panX: number;
  panY: number;
}

export function MapViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);
  const [view, setView] = useState<View>(IDENTITY_VIEW);
  const [dragging, setDragging] = useState(false);

  const mapId = useFilterStore((s) => s.mapId);
  const date = useFilterStore((s) => s.date);
  const matchId = useFilterStore((s) => s.matchId);
  const layers = useFilterStore((s) => s.layers);
  const heatmapMode = useFilterStore((s) => s.heatmapMode);
  const maps = useDataStore((s) => s.manifest?.maps);
  const match = useDataStore((s) => s.match);
  const aggregate = useDataStore((s) => s.aggregate);
  const viewStatus = useDataStore((s) => s.viewStatus);
  const error = useDataStore((s) => s.error);
  const retry = useDataStore((s) => s.retry);

  const mapCfg = mapId && maps ? maps[mapId] : null;
  const size = mapCfg?.size ?? DEFAULT_SIZE;
  // BASE_URL carries a trailing slash and reflects Vite's `base`, so minimaps
  // resolve under a subdirectory deployment (e.g. "/lila/minimaps/...").
  const image = useImage(mapCfg ? `${import.meta.env.BASE_URL}minimaps/${mapCfg.image}` : null);

  // A fresh selection should start fit-to-screen, not inherit the old zoom.
  // React's sanctioned "adjust state when inputs change" pattern (a render-time
  // guard) — no effect, no cascading render.
  const selKey = `${mapId}|${date}|${matchId}`;
  const [prevSel, setPrevSel] = useState(selKey);
  if (selKey !== prevSel) {
    setPrevSel(selKey);
    setView(IDENTITY_VIEW);
  }

  // Mirror latest scene inputs so the render loop and event handlers read current
  // values without re-subscribing. Written in a layout effect (never during
  // render) so it's set before any scheduled rAF fires.
  const sceneRef = useRef<{
    image: HTMLImageElement | null;
    match: typeof match;
    aggregate: typeof aggregate;
    layers: typeof layers;
    heatmapMode: typeof heatmapMode;
    size: number;
    view: View;
    time: number | null;
  }>({ image, match, aggregate, layers, heatmapMode, size, view, time: null });

  /** The full pixel->screen transform for the current size + user view. */
  const currentTransform = useCallback((w: number, h: number): ViewTransform => {
    const { size: sz, view: v } = sceneRef.current;
    return applyView(fitTransform(w, h, sz), v.zoom, v.panX, v.panY, w, h);
  }, []);

  const draw = useCallback(() => {
    rafRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const needW = Math.round(w * dpr);
    const needH = Math.round(h * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW;
      canvas.height = needH;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = sceneRef.current;
    renderScene({
      ctx,
      width: w,
      height: h,
      size: s.size,
      transform: currentTransform(w, h),
      image: s.image,
      match: s.match,
      aggregate: s.aggregate,
      layers: s.layers,
      time: s.time,
      heatmapMode: s.heatmapMode,
    });
  }, [currentTransform]);

  const schedule = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Mirror scene inputs + redraw whenever any of them change. Playback time comes
  // from its store (read here so a match/layer change keeps the current playhead).
  useLayoutEffect(() => {
    const pb = usePlaybackStore.getState();
    sceneRef.current = {
      image,
      match,
      aggregate,
      layers,
      heatmapMode,
      size,
      view,
      time: pb.duration > 0 ? pb.time : null,
    };
    schedule();
  }, [image, match, aggregate, layers, heatmapMode, size, view, schedule]);

  // Playback -> canvas, driven imperatively so advancing `time` ~60×/s never
  // re-renders this component (or the filters). Covers both scrubbing (paused) and
  // the play loop: any playback change mirrors the new time and schedules a redraw.
  useEffect(() => {
    const apply = (s: { time: number; duration: number }) => {
      sceneRef.current.time = s.duration > 0 ? s.time : null;
      schedule();
    };
    apply(usePlaybackStore.getState());
    return usePlaybackStore.subscribe(apply);
  }, [schedule]);

  // The play loop: while playing, advance the playhead by real elapsed wall-clock
  // time (scaled per lib/playback) using rAF timestamps, and auto-pause at the end
  // leaving the playhead parked there. Runs entirely off React state.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      const pb = usePlaybackStore.getState();
      if (!pb.isPlaying) {
        raf = 0;
        last = 0;
        return;
      }
      if (last === 0) last = ts;
      const dt = ts - last;
      last = ts;
      const rate = playbackRate(pb.duration, pb.speed);
      const { time, ended } = advanceTime(pb.time, dt, rate, pb.duration);
      pb.setTime(time);
      if (ended) {
        pb.pause(); // auto-pause at end; no rewind
        raf = 0;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const unsub = usePlaybackStore.subscribe((s, prev) => {
      if (s.isPlaying && !prev.isPlaying && !raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    });
    if (usePlaybackStore.getState().isPlaying && !raf) raf = requestAnimationFrame(tick);
    return () => {
      unsub();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Resize handling (created once).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    sizeRef.current = { w: container.clientWidth, h: container.clientHeight };
    schedule();

    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      sizeRef.current = { w: r.width, h: r.height };
      schedule();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0; // reset, or a StrictMode remount can't reschedule
      }
    };
  }, [schedule]);

  // Wheel-zoom toward the cursor. Native, non-passive so we can preventDefault
  // and stop the page from scrolling. Functional setView keeps the math correct
  // even when several wheel events land before a re-render.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { w, h } = sizeRef.current;
      if (w === 0 || h === 0) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const sz = sceneRef.current.size;
      const fit = fitTransform(w, h, sz);

      setView((prev) => {
        // Pixel under the cursor now — must stay under it after zooming.
        const before = applyView(fit, prev.zoom, prev.panX, prev.panY, w, h);
        const [px, py] = screenToPixel(cx, cy, before);
        const nextZoom = clamp(prev.zoom * Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY), MIN_ZOOM, MAX_ZOOM);
        // Solve pan so (px,py) maps back to (cx,cy) at the new zoom.
        const zeroPan = applyView(fit, nextZoom, 0, 0, w, h);
        const sx0 = zeroPan.offsetX + px * zeroPan.scale;
        const sy0 = zeroPan.offsetY + py * zeroPan.scale;
        const [panX, panY] = clampPan(fit, nextZoom, sz, w, h, cx - sx0, cy - sy0);
        return { zoom: nextZoom, panX, panY };
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // Drag-to-pan via pointer capture.
  const drag = useRef<{ id: number; startX: number; startY: number; panX: number; panY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const { panX, panY } = sceneRef.current.view;
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, panX, panY };
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = sizeRef.current;
    const rect = canvas.getBoundingClientRect();

    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const sz = sceneRef.current.size;
      const fit = fitTransform(w, h, sz);
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setView((prev) => {
        const [panX, panY] = clampPan(fit, prev.zoom, sz, w, h, d.panX + dx, d.panY + dy);
        return { ...prev, panX, panY };
      });
      return;
    }

    // Not dragging → world-coordinate readout.
    if (!mapCfg) return;
    const [px, py] = screenToPixel(e.clientX - rect.left, e.clientY - rect.top, currentTransform(w, h));
    if (px < 0 || px > size || py < 0 || py > size) {
      setCursor(null);
      return;
    }
    const [x, z] = pixelToWorld(px, py, mapCfg);
    setCursor({ x, z });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      setDragging(false);
    }
  };

  const busy = viewStatus === 'loading';
  const failed = viewStatus === 'error';
  const zoomed = view.zoom > MIN_ZOOM + 1e-3 || view.panX !== 0 || view.panY !== 0;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#0a0e17]">
      <canvas
        ref={canvasRef}
        className="block touch-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        role="img"
        aria-label={mapId ? `${mapId} ${match ? 'match' : 'aggregate'} player journey map` : 'map viewport'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setCursor(null)}
      />

      {/* Legend — top-right, context-aware key for colors/glyphs (over the map). */}
      {!busy && !failed && mapId && <Legend />}

      {/* Zoom controls — bottom-left, clear of the coord readout. */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px]">
        <span className="rounded border border-slate-800 bg-slate-900/80 px-2 py-1 font-mono text-slate-400">
          {(view.zoom * 100).toFixed(0)}%
        </span>
        {zoomed && (
          <button
            onClick={() => setView(IDENTITY_VIEW)}
            className="rounded border border-slate-800 bg-slate-900/80 px-2 py-1 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-100"
          >
            Reset
          </button>
        )}
      </div>

      {/* Load / error state — never leave the viewport a silent void. */}
      {busy && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          loading…
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-xs text-red-400">Failed to load view{error ? `: ${error}` : ''}</span>
          <button
            onClick={retry}
            className="rounded border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Retry
          </button>
        </div>
      )}

      {/* World-coordinate readout (the units designers work in). */}
      {cursor && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded border border-slate-800 bg-slate-900/80 px-2 py-1 font-mono text-[11px] text-slate-400">
          x {cursor.x.toFixed(0)} · z {cursor.z.toFixed(0)}
        </div>
      )}
    </div>
  );
}
