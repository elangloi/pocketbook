// Runs just the UI in a regular browser (data goes to localStorage instead of disk).
// Handy for quick UI iteration: `npm run web`.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [react()],
  server: { port: 5199 }
})
