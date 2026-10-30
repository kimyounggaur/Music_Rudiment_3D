import { defineConfig } from 'vite';
import { qaEvidencePlugin } from './scripts/qa-evidence.ts';
export default defineConfig({
  plugins: [qaEvidencePlugin()],
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  cacheDir: '.vite-cache',
  build: {
    target: 'es2022', sourcemap: true,
    // three.js core is one ES module (≈ 695 kB minified) and cannot be split further; every app chunk
    // stays under 250 kB. The limit covers that one library chunk and still flags any other growth.
    chunkSizeWarningLimit: 720,
    rollupOptions: {
      output: {
        // v3 R9: libraries in their own long-cached chunks; the app chunk stays small.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/react') || id.includes('/node_modules/scheduler/')) return 'react';
          return undefined;
        },
      },
    },
  }
});
