/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional browser Sentry DSN. When set at build time, the client enables
   * error tracking (see src/lib/observability.ts); when unset the Sentry SDK is
   * tree-shaken out entirely. Never committed — supplied via the host env.
   */
  readonly VITE_SENTRY_DSN?: string
  /**
   * Deployed commit SHA, injected by netlify.toml's build command from
   * Netlify's own COMMIT_REF. Used to tag Sentry events with a release (see
   * src/lib/observability.ts) so an error maps back to a specific deploy.
   * Unset in local dev — the release tag is simply omitted.
   */
  readonly VITE_COMMIT_REF?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
