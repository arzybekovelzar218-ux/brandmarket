import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend for the dev/preview proxy. Override: BACKEND_URL=http://localhost:8090 npm run dev
const backend = process.env.BACKEND_URL ?? 'http://localhost:8080'
const proxy = {
  '/api': backend,
  '/videos': backend,
  '/uploads': backend,
}

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/ — set BASE_PATH=/<repo>/ for that build
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts'
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('@dnd-kit')) return 'dnd'
        },
      },
    },
  },
})
