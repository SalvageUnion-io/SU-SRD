/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Sentry DSN for browser error monitoring, supplied at build time by
   * `deploy-cloudflare.yml`. Unset (the default) → Sentry is a no-op and
   * `@sentry/browser` is dead-code-eliminated from the bundle.
   */
  readonly VITE_SENTRY_DSN?: string
  /**
   * Deployed commit SHA, set by `deploy-cloudflare.yml`. Used to tag Sentry
   * events with a release (see src/lib/observability.ts) so an error maps back
   * to a specific deploy.
   * Unset in local dev — the release tag is simply omitted.
   */
  readonly VITE_COMMIT_REF?: string
  /**
   * A Worker Preview's own origin (`https://pr-<n>-su-srd.<account>.workers.dev`),
   * set by `deploy-preview.yml`. Unset → production's. See `SITE_URL`.
   */
  readonly VITE_SRD_ORIGIN?: string
  /**
   * The same Preview's ITUN origin, which every ITUN link then points at.
   * Unset → production's. See `ITUN_URL`.
   */
  readonly VITE_ITUN_ORIGIN?: string
}
