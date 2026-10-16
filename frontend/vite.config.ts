import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Static files in public/ that the service worker should precache.
      includeAssets: ['bus-icon.png', 'bus-icon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Sewanee Transit',
        short_name: 'Transit',
        description:
          'Live shuttle tracking for the University of the South. See where Tiger Transit shuttles are right now and when they reach your stop.',
        theme_color: '#582C83',
        background_color: '#F4F1F8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell. Don't touch /api or /ws — those
        // must always hit the network, never a stale cached response.
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
      },
      devOptions: {
        // Let the service worker run in `npm run dev` so you can test the
        // install prompt locally without a production build.
        enabled: true,
      },
    }),
  ],

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