/**
 * The reference site on Astro (ADR-065 spike): every page and endpoint
 * `ssg/routes.ts` and `ssg/endpoints.ts` register, as `astro/pages/`.
 */

import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import { SITE_URL } from './src/lib/constants'

/** `name-hash`, as the Vite pass names them: the bundle-budget specs match chunks by that prefix (`e2e/_bundle.ts`). */
const HASHED_NAMES = {
  entryFileNames: 'assets/[name]-[hash].js',
  chunkFileNames: 'assets/[name]-[hash].js',
  assetFileNames: 'assets/[name]-[hash][extname]',
}

export default defineConfig({
  site: SITE_URL,
  srcDir: './astro',
  publicDir: './public',
  outDir: './dist-astro',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never', assets: 'assets' },
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    environments: {
      client: { build: { rolldownOptions: { output: HASHED_NAMES } } },
      // The stylesheet and the fonts are emitted by the render pass.
      prerender: {
        build: { rolldownOptions: { output: { assetFileNames: HASHED_NAMES.assetFileNames } } },
      },
    },
  },
})
