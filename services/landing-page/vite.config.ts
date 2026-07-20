import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '3000'),
    strictPort: false,
    // Disable host checking in production - Railway proxy handles this
    allowedHosts: process.env.NODE_ENV === 'production' ? ['all'] : [
      'joallm.ai',
      'www.joallm.ai',
      'localhost',
      '.railway.app',
    ],
  },
  server: {
    port: 5173,
    host: true
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
