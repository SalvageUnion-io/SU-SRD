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
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = fileURLToPath(new URL('../dist', import.meta.url))

// Sourcemap upload, mirroring `apps/itun/vite.config.ts` (audit AP-20). srd's
// client bundle is ~500 KB minified, so without maps every production Sentry
// event is a stack of mangled frames in `assets/islands-<hash>.js` — counted,
// and not actionable. Inert unless `SENTRY_AUTH_TOKEN` is set, so local builds,
// CI's `build-srd` job and the output gate never emit or upload a map (the
// gate's emitted-file set is blessed against exactly that build).
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

export default defineConfig({
  root: appRoot,
  base: '/',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  plugins: [
    react(),
    tailwindcss(),
    // Must run last (Sentry's own requirement — it needs the final Rollup output
    // to attach debug ids and upload the maps).
    sentryAuthToken
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: sentryAuthToken,
          // Pinned to the same PUBLIC_COMMIT_REF the client tags itself with at
          // runtime (src/lib/observability.ts). Auto-detecting from git would
          // read CI's shallow clone and could silently mismatch, and a
          // mismatched release is a map that never applies.
          release: { name: process.env.PUBLIC_COMMIT_REF, inject: false },
          sourcemaps: {
            // Uploaded, then removed: the maps must not ship, and they must be
            // gone before `ssg/pwa.ts` globs dist for the precache manifest.
            filesToDeleteAfterUpload: [`${outDir}/**/*.map`],
          },
          // No plugin usage telemetry to Sentry from CI builds.
          telemetry: false,
          // A failing upload (expired token, Sentry blip) degrades to "no maps
          // this deploy" rather than failing it. An ABSENT credential is a
          // different thing, and `deploy-cloudflare.yml` refuses to build
          // without one; this covers the blip, not the gap.
          errorHandler: (error) => {
            console.warn('[sentry-vite-plugin] sourcemap upload failed (non-fatal):', error)
          },
        })
      : false,
  ],
  // Astro exposed `PUBLIC_`-prefixed env to the client bundle; Vite's default is
  // `VITE_`. Without this override `import.meta.env.PUBLIC_SENTRY_DSN` inlines
  // as `undefined`, so Sentry initialises with no DSN and silently reports
  // nothing — while the build, the bundle and the deploy all still look
  // healthy. That is precisely the failure mode `tools/check-observability.ts`
  // exists to catch. Renaming the vars instead is a coordinated change to the
  // repository variables `deploy-cloudflare.yml` reads, so the prefix moves here
  // rather than to the variable names.
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
    outDir,
    // Only when uploading. 'hidden' rather than itun's `true`: the maps are
    // deleted after upload, so a `//# sourceMappingURL` comment would point
    // every browser's devtools at a 404. The plugin's injected debug ids are
    // what Sentry matches on, not that comment.
    sourcemap: sentryAuthToken ? 'hidden' : false,
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
