import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The panel is served by the Express backend as static files. This React app is
// the admin panel: it builds into public/admin and is served at /admin-panel.
// Dev-only: where `npm run dev` proxies API/upload calls. The app talks to a
// same-origin `/api`, so in dev we forward it to a real backend. Override with
// `DEV_API_TARGET` if you run the backend locally (e.g. http://localhost:4000).
const DEV_API_TARGET = process.env.DEV_API_TARGET || 'https://gomeladmin.onrender.com';

export default defineConfig({
  base: '/admin-panel/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': { target: DEV_API_TARGET, changeOrigin: true, secure: true },
      '/uploads': { target: DEV_API_TARGET, changeOrigin: true, secure: true },
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../public/admin', import.meta.url)),
    emptyOutDir: true,
  },
});
