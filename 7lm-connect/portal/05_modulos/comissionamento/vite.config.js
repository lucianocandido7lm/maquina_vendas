import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BUILD_VERSION = '20260616_comissionamento_react_6';

export default defineConfig({
  base: '/02_recursos/05_modulos/comissionamento/',
  plugins: [react()],
  build: {
    outDir: '../../02_publico/02_recursos/05_modulos/comissionamento',
    emptyOutDir: true,
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        entryFileNames: `assets/comissionamento_${BUILD_VERSION}.js`,
        assetFileNames: `assets/[name]_${BUILD_VERSION}[extname]`,
        codeSplitting: false,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
