import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { devCatalogServerPlugin } from './dev-catalog-server-plugin.ts';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tailwindcss(), devCatalogServerPlugin(repoRoot)],
  server: {
    proxy: {
      '/mock-api': { target: 'http://127.0.0.1:8787' },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@legacy': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  build: { outDir: fileURLToPath(new URL('../../dist/web', import.meta.url)), emptyOutDir: true },
});
