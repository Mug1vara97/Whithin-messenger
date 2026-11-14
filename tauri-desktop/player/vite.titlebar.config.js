import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One IIFE that Tauri injects into the site webview as an initialization script.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: fileURLToPath(new URL('../src-tauri/assets', import.meta.url)),
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: fileURLToPath(new URL('./titlebar/main.jsx', import.meta.url)),
      formats: ['iife'],
      name: 'WhithinTitlebarPlayer',
      fileName: () => 'titlebar-player.js',
    },
  },
});
