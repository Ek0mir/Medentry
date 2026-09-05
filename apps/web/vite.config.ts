import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Geliştirmede panel Vite'tan, API Fastify'dan gelir; üretimde ikisi de
    // aynı porttan sunulur (Fastify derlenmiş dist'i statik olarak verir).
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 900 },
});
