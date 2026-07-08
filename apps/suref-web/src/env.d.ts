/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Sentry DSN for browser error monitoring. `PUBLIC_`-prefixed so Astro
   * exposes it to the client bundle. Unset (the default) → Sentry is a no-op
   * and `@sentry/browser` is dead-code-eliminated from the bundle.
   */
  readonly PUBLIC_SENTRY_DSN?: string
  /**
   * Deployed commit SHA, injected by netlify.toml's build command from
   * Netlify's own COMMIT_REF. Used to tag Sentry events with a release (see
   * src/lib/observability.ts) so an error maps back to a specific deploy.
   * Unset in local dev — the release tag is simply omitted.
   */
  readonly PUBLIC_COMMIT_REF?: string
}
