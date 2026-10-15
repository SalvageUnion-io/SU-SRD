/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The Convex deployment's client URL. Every build carries one:
   * `vite.config.ts` refuses to start without it (`bun run dev:cantina` writes it
   * into `.env.local`; CI and the deploy pass it in the environment).
   */
  readonly VITE_CONVEX_URL: string
  /**
   * Deployed commit SHA, set by `deploy-cloudflare.yml`. Sent with each error
   * report (see src/lib/observability.ts) so an error maps back to a deploy.
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
  readonly VITE_CANTINA_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
