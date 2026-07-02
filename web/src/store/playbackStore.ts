/**
 * Timeline playback state. Deliberately isolated: during playback `time` updates
 * ~60×/sec, so only components subscribed to *this* store re-render — filters and
 * layer toggles stay untouched. This separation is the key perf decision.
 */

import { create } from 'zustand';
import { clampTime } from '../lib/playback';

interface PlaybackState {
  time: number; // current position, ms since match start
  duration: number; // endTs of the active match
  isPlaying: boolean;
  speed: number; // playback rate multiplier
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setTime: (time: number) => void;
  setSpeed: (speed: number) => void;
  setDuration: (duration: number) => void;
  reset: () => void;
}

// Pressing play while parked at the end restarts from 0 (standard media-player
// behavior); otherwise resume from the current position.
function startTime(time: number, duration: number): number {
  return duration > 0 && time >= duration ? 0 : time;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  time: 0,
  duration: 0,
  isPlaying: false,
  speed: 1,
  play: () => set((s) => ({ isPlaying: true, time: startTime(s.time, s.duration) })),
  pause: () => set({ isPlaying: false }),
  toggle: () =>
    set((s) =>
      s.isPlaying
        ? { isPlaying: false }
        : { isPlaying: true, time: startTime(s.time, s.duration) },
    ),
  setTime: (time) => set((s) => ({ time: clampTime(time, s.duration) })),
  setSpeed: (speed) => set({ speed }),
  setDuration: (duration) => set({ duration }),
  reset: () => set({ time: 0, isPlaying: false }),
}));
