import { defineConfig } from 'vite'
import type { PluginOption } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    react({
      jsxRuntime: 'automatic',
    }),
    netlify(),
    mode === 'analyze' &&
      visualizer({
        open: true,
        filename: './dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean) as PluginOption[],
  server: {
    watch: {
      ignored: ['**/routeTree.gen.ts'],
    },
  },
}))
