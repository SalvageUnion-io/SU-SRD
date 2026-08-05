/**
 * The client-bundle Vite config for the in-house SSG.
 *
 * It lives under `ssg/` (and is passed to `build()` explicitly) rather than at
 * the app root as `vite.config.ts`, so it can never be picked up by anything
 * else while the Astro build still exists beside it.
 *
 * There is NO server build here: the SSR pass runs under Bun, straight from
 * TypeScript source. Vite only ever produces the browser assets.
 */

import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: appRoot,
  base: '/',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        islands: fileURLToPath(new URL('../src/runtime/islands.client.ts', import.meta.url)),
        styles: fileURLToPath(new URL('../src/runtime/styles.entry.ts', import.meta.url)),
      },
      output: {
        manualChunks(id: string) {
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/scheduler')
          ) {
            return 'react-vendor'
          }
          // No manual chunk for salvageunion-reference: its JSON data files are
          // dynamically imported (ModelFactory dataLoaders), so Rollup naturally
          // splits them into per-schema chunks that only load when preload()
          // runs. Forcing them into one chunk made every page ship the full
          // ~1.4 MB data corpus via SearchIsland's static imports.
          return undefined
        },
      },
    },
  },
})
