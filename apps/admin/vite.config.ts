import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import path from 'node:path';
import { adminProvisionalApiPlugin } from './dev-provisional-api-plugin.ts';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tailwindcss(), adminProvisionalApiPlugin(repoRoot)],
  server: { proxy: { '/mock-api': { target: `http://127.0.0.1:${process.env.MELEARN_MOCK_PORT ?? 8787}` } } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  build: { outDir: fileURLToPath(new URL('../../dist/admin', import.meta.url)), emptyOutDir: true },
});
