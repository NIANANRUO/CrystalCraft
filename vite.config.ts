import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative assets work at /, /repository-name/, and under a custom domain.
  base: './',
  plugins: [react(), {
    name: 'production-security-policy', apply: 'build',
    transformIndexHtml() { return [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'" }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ]; },
  }],
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
