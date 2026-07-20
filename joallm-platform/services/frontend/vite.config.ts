import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Canonical Knowledge Acquisition / platform contracts
      '@joallm/shared': path.resolve(__dirname, '../../shared/types'),
    },
  },
  server: {
    port: 5174,
    host: true
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '5174'),
    strictPort: false,
    // Disable host checking in production - Railway proxy handles this
    allowedHosts: process.env.NODE_ENV === 'production' ? ['all'] : [
      'platform.atrisi.org',
      'platform.joallm.ai',
      'joallm.ai',
      'localhost',
      '127.0.0.1',
      '.railway.app',
      '.up.railway.app',
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
