/**
 * Sentry sourcemap upload for the two browser apps' Vite builds.
 *
 * Without maps every production event is a stack of mangled frames in a
 * content-hashed chunk: counted, and not actionable. srd and itun each carried
 * a copy of this block, and the copies had already diverged: itun built with
 * `sourcemap: true`, so every chunk shipped a `//# sourceMappingURL` comment
 * naming a `.map` the upload then deleted, and every browser's devtools fetched
 * a 404. One source means one behaviour.
 *
 * Entirely env-gated on `SENTRY_AUTH_TOKEN`. Absent locally and in CI, so this
 * returns no plugins and Vite emits no maps. `deploy-cloudflare.yml` is the one
 * place it is set, and it refuses to build without the token, org and project.
 *
 * Put the result LAST in `plugins` (Sentry's own requirement: it needs the
 * final Rollup output to attach debug ids and upload the maps).
 */

import { sentryVitePlugin } from '@sentry/vite-plugin'

/**
 * A failing upload (expired token, Sentry blip) degrades to "no maps this
 * deploy" rather than failing it — the plugin's default is to throw. An ABSENT
 * credential is a different thing, and `deploy-cloudflare.yml` refuses to build
 * without one; this covers the blip, not the gap.
 */
export function warnUploadFailed(error: unknown): void {
  console.warn('[sentry-vite-plugin] sourcemap upload failed (non-fatal):', error)
}

/**
 * @param outDir the build's output directory; its `.map` files are deleted
 *   once uploaded, so the maps never ship.
 */
export function sentrySourcemaps(outDir: string) {
  const authToken = process.env.SENTRY_AUTH_TOKEN
  if (!authToken) return []

  return [
    {
      name: 'observability:hidden-sourcemaps',
      // 'hidden', never `true`: the maps are deleted after upload, so a
      // `//# sourceMappingURL` comment would point devtools at a 404. The
      // injected debug ids are what Sentry matches on, not that comment.
      config: () => ({ build: { sourcemap: 'hidden' as const } }),
    },
    ...sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken,
      // Pinned to the same VITE_COMMIT_REF the client tags itself with at
      // runtime (each app's `src/lib/observability.ts`). Auto-detecting from
      // git would read CI's shallow clone and could silently mismatch, and a
      // mismatched release is a map that never applies.
      release: { name: process.env.VITE_COMMIT_REF, inject: false },
      // Uploaded, then removed: the maps must not ship.
      sourcemaps: { filesToDeleteAfterUpload: [`${outDir}/**/*.map`] },
      // No plugin usage telemetry to Sentry from CI builds.
      telemetry: false,
      errorHandler: warnUploadFailed,
    }),
  ]
}
