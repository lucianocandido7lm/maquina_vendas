import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BUILD_VERSION = '20260616_corretor_matrix_1'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/02_recursos/05_modulos/dashboard_comercial/',
  plugins: [react()],
  build: {
    outDir: '../../02_publico/02_recursos/05_modulos/dashboard_comercial',
    emptyOutDir: true,
    chunkSizeWarningLimit: 450,
    rollupOptions: {
      output: {
        entryFileNames: `assets/dashboard_comercial_${BUILD_VERSION}.js`,
        chunkFileNames: `assets/[name]_${BUILD_VERSION}.js`,
        assetFileNames: `assets/[name]_${BUILD_VERSION}[extname]`,
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-core'
          if (id.includes('xlsx-populate')) return 'xlsx-export'
          if (id.includes('recharts')) return 'charts'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('react-router-dom')) return 'router'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('/zod/')) return 'zod'
          return 'vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
