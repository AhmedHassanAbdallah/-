import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the bundle works from file:// style origins (Capacitor WebView) and any sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
