import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // No proxy needed - Vercel dev handles API routes directly
  // When using 'vercel dev', API routes are served on the same port as the frontend
});
