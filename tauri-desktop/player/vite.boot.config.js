import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The D20 boot preloader, injected into the main webview as an initialization script.
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: fileURLToPath(new URL('../src-tauri/assets', import.meta.url)),
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: fileURLToPath(new URL('./boot/main.js', import.meta.url)),
      formats: ['iife'],
      name: 'WhithinBootLoaderBundle',
      fileName: () => 'boot-loader.js',
    },
  },
});
