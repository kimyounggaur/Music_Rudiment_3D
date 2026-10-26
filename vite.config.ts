import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  cacheDir: '.vite-cache',
  build: { target: 'es2022', sourcemap: true }
});
