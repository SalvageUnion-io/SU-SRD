/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional browser Sentry DSN. When set at build time, the client enables
   * error tracking (see src/lib/observability.ts); when unset the Sentry SDK is
   * tree-shaken out entirely. Never committed — supplied via the host env.
   */
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
