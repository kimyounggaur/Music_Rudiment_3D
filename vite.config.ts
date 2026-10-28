import { defineConfig } from 'vite';
import { qaEvidencePlugin } from './scripts/qa-evidence.ts';
export default defineConfig({
  plugins: [qaEvidencePlugin()],
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  cacheDir: '.vite-cache',
  build: { target: 'es2022', sourcemap: true }
});
