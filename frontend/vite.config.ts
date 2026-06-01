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
  host: true,
  allowedHosts: [".ngrok-free.app", ".ngrok.io", ".ngrok-free.dev"],
  hmr: process.env.NGROK
    ? { clientPort: 443 }
    : undefined,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:8000',
      ws: true,
      rewriteWsOrigin: true,
    },
  },
  },
});