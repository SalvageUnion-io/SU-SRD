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
  // Astro exposed `PUBLIC_`-prefixed env to the client bundle; Vite's default is
  // `VITE_`. Without this override `import.meta.env.PUBLIC_SENTRY_DSN` inlines
  // as `undefined`, so Sentry initialises with no DSN and silently reports
  // nothing — while the build, the bundle and the deploy all still look
  // healthy. That is precisely the failure mode `tools/check-observability.ts`
  // exists to catch. Renaming the vars instead would break the values already
  // configured in the Netlify UI, so the prefix moves here rather than to the
  // variable names.
  envPrefix: 'PUBLIC_',
  // Carried over from the deleted astro.config.mjs, where it fixed a specific,
  // nasty dev-only bug: the island deps live under component-lib/node_modules
  // (@base-ui, sonner, lucide-react, cva, @randsum) and were only DISCOVERED
  // when an island first imported them, so Vite re-ran its dep optimizer
  // mid-navigation and answered in-flight island chunk requests with 504
  // "Outdated Optimize Dep" — cards stuck on their skeletons, with transient
  // stale-React `jsxDEV` errors.
  //
  // It matters MORE here than it did under Astro. `ssg/dev.ts` runs Vite with
  // `appType: 'custom'` and this app has no index.html anywhere in the root, so
  // Vite's default scanner entry (`**/*.html`) matches nothing: without these
  // explicit entries the optimizer starts from zero and discovers everything
  // lazily, on the first browser request.
  //
  // Dev-only — `vite build` runs Rollup with no dep optimizer, which is why
  // production was never affected and why this cannot regress the build.
  //
  // (astro.config.mjs also set `resolve.conditions: ['development']`. That is
  // deliberately NOT carried over: neither workspace package declares a
  // `development` export condition — both resolve straight to source — so it
  // was inert. Checked, not assumed.)
  optimizeDeps: {
    include: ['salvageunion-reference'],
    entries: ['src/components/islands/**/*.{ts,tsx}'],
  },
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
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
