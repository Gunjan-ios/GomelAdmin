import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The panel is served by the Express backend as static files. The vanilla panel
// lives at /admin-panel (public/admin); this React port builds into
// public/admin-react and is served at /admin-react so both can run side by side
// until the React version is promoted. Change `base` + `outDir` together to
// promote it to /admin-panel.
export default defineConfig({
  base: '/admin-react/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../public/admin-react', import.meta.url)),
    emptyOutDir: true,
  },
});
