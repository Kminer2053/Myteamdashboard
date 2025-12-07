import { defineConfig } from 'vite';

export default defineConfig({
  base: '/news-clipping/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    port: 8002,
    proxy: {
      '^/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  }
});

