/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:3300'
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': '/src' } },
    server: {
      port: 5180,
      strictPort: true,
      proxy: { '/api': { target, changeOrigin: true } },
    },
    preview: {
      port: 5180,
      proxy: { '/api': { target, changeOrigin: true } },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Separa librerías pesadas para mejorar caché y carga inicial (RNF-007).
          manualChunks: (id: string) => {
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'
            if (id.includes('node_modules/@tanstack')) return 'tanstack'
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react'
            return undefined
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }
})
