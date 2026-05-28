import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
  ],
  optimizeDeps: {
    exclude: ['stripe']
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries — long-lived, cacheable across deploys.
          'react-vendor': ['react', 'react-dom'],

          // State management — touched by nearly every page; small enough
          // that bundling together avoids per-route duplication.
          'state-vendor': ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],

          // Data fetching — same rationale as state-vendor.
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-table'],

          // Form handling — used on most input-heavy pages; co-locating
          // keeps zod in one place instead of inlined per page.
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],

          // Date and utility libraries — cheap and shared widely.
          'utils-vendor': ['date-fns', 'nanoid'],

          // NOTE: deliberately removed from manualChunks (Vite will
          // split them per-route via its import graph):
          //   * @radix-ui/* — 12 primitives bundled all-or-nothing as
          //     `radix-vendor` (~276 KB) loaded modulepreloaded on every
          //     route, even pages using 3-4 primitives.
          //   * lucide-react / class-variance-authority / clsx /
          //     tailwind-merge — were `ui-vendor` (~115 KB); lucide
          //     tree-shakes very well per icon set used per page.
          //   * @aws-sdk/* — server-only deps. Used by R2/S3 (avatars,
          //     newsletter images, card images) and SES (transactional
          //     email). Manualchunking them caused Vite to emit an
          //     `aws-vendor` chunk and modulepreload it on every cold
          //     load even though no client code imports them.
          // recharts stays out so it ships only with /email-analytics
          // and /analytics (already lazy-loaded routes).
        }
      }
    },
    // Most route chunks are well below 500 KB; large editor / chart
    // chunks (ClassicPuckEditor, AreaChart) are knowingly lazy-loaded
    // and don't affect cold start.
    chunkSizeWarningLimit: 1000
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    hmr: {
      host: '0.0.0.0',
      // Let Vite automatically determine the client port
      // This works better with proxies and tunnels
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false,
      }
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
