import { defineConfig } from 'vitest/config';

// Standalone from vite.config.ts on purpose: the pure playback/format logic needs
// no DOM, React, or Tailwind — a plain Node environment keeps the run fast.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
