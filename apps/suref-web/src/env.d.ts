/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Sentry DSN for browser error monitoring. `PUBLIC_`-prefixed so Astro
   * exposes it to the client bundle. Unset (the default) → Sentry is a no-op
   * and `@sentry/browser` is dead-code-eliminated from the bundle.
   */
  readonly PUBLIC_SENTRY_DSN?: string
}
