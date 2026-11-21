import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'logos/*.png'],
      manifest: {
        name: 'Out of Bounds',
        short_name: 'Out of Bounds',
        description: 'Pop your campus bubble. Collect stamps across Boston neighborhoods.',
        theme_color: '#14213D',
        background_color: '#F6F3EC',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    // The game rules live in ../shared so the API server can use them too.
    fs: { allow: ['..'] },
    // In dev, API calls go to the local server (server/ on port 8787).
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
});
