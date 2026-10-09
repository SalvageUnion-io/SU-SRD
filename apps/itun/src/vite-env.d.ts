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
   * The deployed commit's time in Unix seconds, set by `deploy-cloudflare.yml`
   * beside the same value written into `convex/buildFloor.ts`. A bundle below
   * the backend's floor is outdated and reloads (src/lib/connection/buildFloor.ts).
   * Unset in local dev, CI and e2e builds, which are never outdated.
   */
  readonly VITE_BUILD_STAMP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * ITUN's changelog, read from `main`'s history when `vite.config.ts` loads and
 * inlined by `define` (ADR-041). Only `routes/changelog.tsx` reads it, so it
 * ships in that route's chunk.
 */
declare const __ITUN_CHANGELOG__: ReturnType<
  typeof import('component-lib/changelog/git').readChangelog
>
