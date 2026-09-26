/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pieces/*.svg', 'privacy.html'],
      manifest: {
        id: '/',
        name: 'PseudoChess',
        short_name: 'PseudoChess',
        description: 'Reverse chess with forced captures. Lose all your pieces, or get checkmated, to win.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        theme_color: '#211c2e',
        background_color: '#211c2e',
        categories: ['games', 'entertainment'],
        prefer_related_applications: false,
        launch_handler: { client_mode: 'focus-existing' },
        screenshots: [
          { src: 'screenshots/wide.png', sizes: '1366x768', type: 'image/png', form_factor: 'wide', label: 'A game against the computer, with forced captures marked in gold' },
          { src: 'screenshots/narrow.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'PseudoChess on a phone' },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Screenshots are only for install dialogs and store listings; no need to precache them.
        globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest,woff2}', 'icons/*.png'],
        navigateFallbackDenylist: [/^\/privacy/],
        // Music is ~7 MB, too much to precache on install: cache each track the first time it plays.
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.+\.mp3$/,
            handler: 'CacheFirst',
            options: { cacheName: 'music', cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 4 } },
          },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
