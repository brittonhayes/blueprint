import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site is served from /<repo>/.
// Allow override via BASE_PATH for custom domains / local preview.
const base = process.env.BASE_PATH ?? '/tldraw-blueprints/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
})
