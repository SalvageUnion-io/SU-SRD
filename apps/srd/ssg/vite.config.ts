/**
 * The client-bundle Vite config for the in-house SSG.
 *
 * It lives under `ssg/` (and is passed to `build()` explicitly) rather than at
 * the app root as `vite.config.ts`, so no other tool picks it up implicitly.
 *
 * There is NO server build here: the SSR pass runs under Bun, straight from
 * TypeScript source. Vite only ever produces the browser assets.
 */

import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { sentrySourcemaps } from 'observability/vite'
import { defineConfig } from 'vite'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = fileURLToPath(new URL('../dist', import.meta.url))

export default defineConfig({
  root: appRoot,
  base: '/',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  plugins: [
    react(),
    tailwindcss(),
    // Must run last; inert without SENTRY_AUTH_TOKEN (see observability/vite).
    ...sentrySourcemaps(outDir),
  ],
  // Fixes a dev-only bug: the island deps live under component-lib/node_modules
  // (@base-ui, sonner, lucide-react, cva) and were only DISCOVERED
  // when an island first imported them, so Vite re-ran its dep optimizer
  // mid-navigation and answered in-flight island chunk requests with 504
  // "Outdated Optimize Dep" — cards stuck on their skeletons, with transient
  // stale-React `jsxDEV` errors.
  //
  // `ssg/dev.ts` runs Vite with `appType: 'custom'` and this app has no
  // index.html anywhere in the root, so Vite's default scanner entry
  // (`**/*.html`) matches nothing: without these explicit entries the optimizer
  // starts from zero and discovers everything lazily, on the first browser
  // request.
  //
  // Dev-only — `vite build` runs Rollup with no dep optimizer, which is why
  // production was never affected and why this cannot regress the build.
  optimizeDeps: {
    include: ['salvageunion-reference'],
    entries: ['src/components/islands/**/*.{ts,tsx}'],
  },
  build: {
    outDir,
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        islands: fileURLToPath(new URL('../src/runtime/islands.client.ts', import.meta.url)),
        styles: fileURLToPath(new URL('../src/runtime/styles.entry.ts', import.meta.url)),
        // Neither of the two below is ever linked into a page (see
        // NON_LINKED_ENTRIES in ssg/build.ts). They are entries so that Vite
        // processes the resources they import: `styles` the css, `assets` the
        // static files under `src/assets/` that pages address by manifest key.
        assets: fileURLToPath(new URL('../src/runtime/assets.entry.ts', import.meta.url)),
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
