import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    // `@/foo` resolves to `src/foo`. Mirrored in tsconfig.app.json's
    // compilerOptions.paths so TypeScript understands it too.
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,

    // Dev-only proxy. The frontend and the FastAPI backend run on
    // different ports during development; without a proxy, every
    // request would be cross-origin and the HttpOnly auth cookies
    // (which the backend sets at /api/auth/login) wouldn't ride
    // along on subsequent requests.
    //
    // In production these will be served from the same origin (or
    // configured with prod URLs via .env files); this proxy is dev-only.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // WebSocket for live shuttle pings.
      // ws:true upgrades the connection; rewriteWsOrigin keeps strict
      // origin-checking servers happy.
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
});