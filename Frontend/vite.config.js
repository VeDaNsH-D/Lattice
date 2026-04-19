import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react-force-graph-3d') || id.includes('three') || id.includes('3d-force-graph')) {
            return 'vendor-graph3d'
          }

          if (id.includes('lottie-web') || id.includes('lottie-react')) {
            return 'vendor-lottie'
          }

          if (id.includes('react-router')) {
            return 'vendor-router'
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }

          return 'vendor'
        },
      },
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' && String(warning.id || '').includes('node_modules/lottie-web')) {
          return
        }

        warn(warning)
      },
    },
  },
})
