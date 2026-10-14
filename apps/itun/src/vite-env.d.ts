/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The Convex deployment's client URL. Every build carries one:
   * `vite.config.ts` refuses to start without it (`bun run dev:itun` writes it
   * into `.env.local`; CI and the deploy pass it in the environment).
   */
  readonly VITE_CONVEX_URL: string
  /**
   * Optional browser Sentry DSN. When set at build time, the client enables
   * error tracking (see src/lib/observability.ts); when unset the Sentry SDK is
   * tree-shaken out entirely. Never committed — supplied via the host env.
   */
  readonly VITE_SENTRY_DSN?: string
  /**
   * Deployed commit SHA, set by `deploy-cloudflare.yml`. Used to tag Sentry events with a release (see
   * src/lib/observability.ts) so an error maps back to a specific deploy.
   * Unset in local dev — the release tag is simply omitted.
   */
  readonly VITE_COMMIT_REF?: string
  /**
   * A Worker Preview's SRD origin (`https://pr-<n>-su-srd.<account>.workers.dev`),
   * set by `deploy-preview.yml`, so the Preview links its own SRD. Unset →
   * production's. See `src/lib/srdOrigin.ts`.
   */
  readonly VITE_SRD_ORIGIN?: string
  /**
   * A Worker Preview's own origin, which the shell's default link-preview
   * tags are rewritten onto at build time (`vite.config.ts`). Unset →
   * production's.
   */
  readonly VITE_ITUN_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
