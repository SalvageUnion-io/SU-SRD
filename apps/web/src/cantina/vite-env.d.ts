/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The Convex deployment's client URL. Every build carries one:
   * `vite.cantina.config.ts` refuses to start without it (`bun run dev` writes it
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
   * A Worker Preview's origin (`https://pr-<n>-su-srd.<account>.workers.dev`),
   * set by `deploy-preview.yml`, which the shell's link-preview tags, the
   * pre-rendered public pages and the sitemap name (`vite.cantina.config.ts`).
   * Unset → production's. Links need none: they are the page's own origin.
   */
  readonly VITE_SITE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
