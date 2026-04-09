import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Babel-free Fast Refresh via SWC is picked up automatically in v5+
      // babel: undefined, — left as default for maximum compat
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // ── CSS ──────────────────────────────────────────────────────────────────
  css: {
    devSourcemap: true, // inline source-maps in dev for accurate line numbers
  },

  // ── Dev server ───────────────────────────────────────────────────────────
  server: {
    port: 5174,
    strictPort: true,       // fail fast instead of auto-incrementing port
    open: false,
    cors: true,

    hmr: {
      overlay: true,        // show runtime errors as an overlay in the browser
    },

    // Pre-transform key entry files so first load is instant
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/components/Layout.tsx',
      ],
    },

    proxy: {
      '/admin-api': {
        target: 'http://localhost:5100',
        changeOrigin: true,
      },
    },
  },

  // ── Preview (vite preview) ────────────────────────────────────────────────
  preview: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/admin-api': {
        target: 'http://localhost:5100',
        changeOrigin: true,
      },
    },
  },

  // ── Build ─────────────────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    target: 'esnext',            // ship modern JS — no down-level transpilation
    // minify defaults to 'oxc' in Vite 8 (Rolldown's native minifier — fastest)
    sourcemap: false,            // disable for production; flip to true for debugging
    cssCodeSplit: true,          // each async chunk gets its own CSS file
    reportCompressedSize: false, // skip gzip measurement → faster build output
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Rolldown requires manualChunks as a function (not a plain object)
        manualChunks(id) {
          if (id.includes('react-dom') || id.includes('react-router-dom') || /node_modules\/react[/@]/.test(id)) {
            return 'vendor-react';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
        },

        // Content-hash filenames for long-lived caching
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },

  // ── Dependency pre-bundling ───────────────────────────────────────────────
  optimizeDeps: {
    // Force-include so Vite pre-bundles them on startup rather than on first import
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'lucide-react',
    ],
    // Exclude server-only packages from client pre-bundling
    exclude: [
      'express',
      'bcryptjs',
      'jsonwebtoken',
      'cookie-parser',
      'drizzle-orm',
      'postgres',
    ],
  },
});
