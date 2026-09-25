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
      includeAssets: ['favicon.svg', 'pieces/*.svg'],
      manifest: {
        id: '/',
        name: 'PseudoChess',
        short_name: 'PseudoChess',
        description: 'Reverse chess with forced captures. Lose all your pieces, or get checkmated, to win.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1c1917',
        background_color: '#1c1917',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
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
