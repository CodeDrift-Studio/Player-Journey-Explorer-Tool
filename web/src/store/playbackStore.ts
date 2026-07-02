/**
 * Timeline playback state. Deliberately isolated: during playback `time` updates
 * ~60×/sec, so only components subscribed to *this* store re-render — filters and
 * layer toggles stay untouched. This separation is the key perf decision.
 */

import { create } from 'zustand';

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

export const usePlaybackStore = create<PlaybackState>((set) => ({
  time: 0,
  duration: 0,
  isPlaying: false,
  speed: 1,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setTime: (time) => set({ time }),
  setSpeed: (speed) => set({ speed }),
  setDuration: (duration) => set({ duration }),
  reset: () => set({ time: 0, isPlaying: false }),
}));
