import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
