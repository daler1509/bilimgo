import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    modules: { localsConvention: 'camelCaseOnly' },
  },
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    // the MapLibre engine is a lazily loaded chunk of ~1 MB (≈280 KB gzip)
    chunkSizeWarningLimit: 1100,
  },
});
