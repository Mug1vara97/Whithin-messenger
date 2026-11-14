import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds into one self-contained music.html that the Tauri binary embeds (whithin-asset://).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL('../src-tauri/assets', import.meta.url)),
    emptyOutDir: false,
    rollupOptions: { input: fileURLToPath(new URL('./music.html', import.meta.url)) },
  },
});
