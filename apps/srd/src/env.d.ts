/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Sentry DSN for browser error monitoring. The `PUBLIC_` prefix is retained
   * from the Astro build that preceded this one, and is now honoured by
   * `envPrefix` in `ssg/vite.config.ts` rather than by Astro — renaming it
   * would silently unset the DSN on every deploy. Unset (the default) → Sentry
   * is a no-op and `@sentry/browser` is dead-code-eliminated from the bundle.
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
