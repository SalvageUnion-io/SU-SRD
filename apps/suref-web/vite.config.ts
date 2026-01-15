import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackStart(),
    react({
      jsxRuntime: 'automatic',
    }),
    netlify(),
    // Bundle analyzer - only in analyze mode
    mode === 'analyze' &&
      visualizer({
        open: true,
        filename: './dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  server: {
    watch: {
      ignored: ['**/routeTree.gen.ts'],
    },
  },
}))
