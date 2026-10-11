import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The console talks to the FastAPI backend. In dev we proxy the API paths it
// uses to the backend origin so calls stay same-origin (no CORS, and the keyless
// map proxy works). Override the target with VITE_API_TARGET if the backend runs
// elsewhere. In production, serve the SPA behind the same origin as the API.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8000'
const API_PATHS = [
  '/me', '/auth', '/status', '/stations', '/incidents', '/telemetry',
  '/gate-command', '/alerts', '/audit', '/automation', '/river-health', '/map', '/subscribers',
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Referrer-Policy': 'no-referrer-when-downgrade',
    },
    proxy: Object.fromEntries(
      API_PATHS.map((p) => [p, { target: API_TARGET, changeOrigin: true }]),
    ),
  },
})
