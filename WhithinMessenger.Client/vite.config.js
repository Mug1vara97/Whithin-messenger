import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const crossOriginResourcePolicyPlugin = () => ({
  name: 'cross-origin-resource-policy-public',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (/\.(webp|png|gif|apng|webm|wasm|worklet\.js)$/i.test(req.url || '')) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      }
      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crossOriginResourcePolicyPlugin()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      process: 'process/browser',
      stream: 'stream-browserify',
      zlib: 'browserify-zlib',
      util: 'util',
    }
  },
  optimizeDeps: {
    exclude: ['@sapphi-red/web-noise-suppressor']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.worklet.js')) {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  server: {
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5117',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
    }
  },
  worker: {
    format: 'es'
  }
})
