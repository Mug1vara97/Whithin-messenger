import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The «Кино» tab, embedded like music.html.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL('../src-tauri/assets', import.meta.url)),
    emptyOutDir: false,
    rollupOptions: { input: fileURLToPath(new URL('./cinema.html', import.meta.url)) },
  },
});
