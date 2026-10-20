import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative assets work at /, /repository-name/, and under a custom domain.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], react: ['react', 'react-dom', 'react-dom/client'] }
      }
    }
  }
});
