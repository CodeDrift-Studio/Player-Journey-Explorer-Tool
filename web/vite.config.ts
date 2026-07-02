import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // tailwindcss() scans our source at build time and generates only the utility
  // classes we actually use — nothing unused ships to the browser.
  plugins: [react(), tailwindcss()],
})
