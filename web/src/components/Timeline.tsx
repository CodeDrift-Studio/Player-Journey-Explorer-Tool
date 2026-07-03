/**
 * Footer playback control bar. This is the ONLY component that subscribes to the
 * high-frequency playback store reactively — it re-renders as `time` advances to
 * move the scrubber and update the readouts. The Canvas is driven imperatively in
 * MapViewport (subscribe/getState), so playback never re-renders the map or filters.
 *
 * Always visible. In aggregate view (no single-match timeline) the controls are
 * disabled with an explanatory message rather than hidden, so the behavior is clear.
 */

import { formatSeconds } from '../lib/format';
import { computePlaybackStats, PLAYBACK_SPEEDS } from '../lib/playback';
import { useDataStore } from '../store/dataStore';
import { usePlaybackStore } from '../store/playbackStore';

export function Timeline() {
  const time = usePlaybackStore((s) => s.time);
  const duration = usePlaybackStore((s) => s.duration);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const speed = usePlaybackStore((s) => s.speed);
  const toggle = usePlaybackStore((s) => s.toggle);
  const setTime = usePlaybackStore((s) => s.setTime);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);
  const match = useDataStore((s) => s.match);

  const enabled = duration > 0;
  const stats = computePlaybackStats(match, time, duration, speed);

  return (
    <footer className="flex h-14 shrink-0 items-center gap-4 border-t border-slate-800 bg-slate-900/40 px-4 text-[0.8125rem]">
      <button
        type="button"
        onClick={toggle}
        disabled={!enabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-sm text-slate-200 transition-colors hover:enabled:bg-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>

      {enabled ? (
        <>
          <span className="shrink-0 font-mono tabular-nums text-slate-400">
            {formatSeconds(time)}
            <span className="text-slate-600"> / {formatSeconds(duration)}</span>
          </span>

          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
            aria-label="Timeline scrubber"
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-indigo-500"
          />

          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Playback speed">
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={`rounded-md px-2 py-1 font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 ${
                  speed === s
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <span className="shrink-0 font-mono tabular-nums text-slate-500" aria-live="off">
            <span className="text-slate-400">{stats.visiblePlayers}</span>/{stats.totalPlayers} players
            <span className="mx-1 text-slate-700">·</span>
            <span className="text-slate-400">{stats.visibleEvents}</span>/{stats.totalEvents} events
          </span>
        </>
      ) : (
        <span className="text-slate-600">Playback available for individual matches only.</span>
      )}
    </footer>
  );
}
