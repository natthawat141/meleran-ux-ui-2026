import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@legacy': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  build: { outDir: fileURLToPath(new URL('../../dist/web', import.meta.url)), emptyOutDir: true },
});
