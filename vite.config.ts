import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
const base = process.env.BASE_PATH || '/';
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'apex.svg'],
      manifest: {
        id: base,
        name: 'PROJECT APEX — Athletic Recomposition',
        short_name: 'APEX',
        description: 'Your private strength and conditioning training companion.',
        theme_color: '#101313',
        background_color: '#101313',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4000000,
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'], environment: 'node' },
});
