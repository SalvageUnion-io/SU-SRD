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
}
