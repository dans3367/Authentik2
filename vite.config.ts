import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
  ],
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
          // Core React libraries
          'react-vendor': ['react', 'react-dom'],
          
          // State management
          'state-vendor': ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],
          
          // Data fetching
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-table'],
          
          // UI component libraries
          'radix-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip'
          ],
          
          // Form handling
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // Charts and data visualization
          'charts-vendor': ['recharts'],
          
          // Icons and styling
          'ui-vendor': [
            'lucide-react',
            'react-icons',
            'framer-motion',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ],
          
          // Date and utility libraries
          'utils-vendor': ['date-fns', 'nanoid'],
          
          // Payment processing
          'stripe-vendor': ['@stripe/stripe-js', '@stripe/react-stripe-js', 'stripe'],
          
          // AWS and cloud services
          'aws-vendor': ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner']
        }
      }
    },
    // Increase chunk size warning limit to 1000kb
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
        target: 'http://localhost:5000',
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
