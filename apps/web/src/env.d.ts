/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

interface ImportMetaEnv {
  /**
   * The Convex deployment's client URL, which only the Cantina reads. Every
   * build carries one: `vite.config.ts` refuses to start without it
   * (`bun run dev` writes it into `.env.local`; CI and the deploy pass it in
   * the environment).
   */
  readonly VITE_CONVEX_URL: string
  /**
   * Deployed commit SHA, set by `deploy-cloudflare.yml`. Sent with each error
   * report (see src/lib/observability.ts) so an error maps back to a deploy.
   * Unset in local dev — the release tag is simply omitted.
   */
  readonly VITE_COMMIT_REF?: string
  /**
   * A Worker Preview's own origin (`https://pr-<n>-su-srd.<account>.workers.dev`),
   * set by `deploy-preview.yml`; the dev server's, by `ssg/dev.ts`. Unset →
   * production's. See `SITE_URL`. The Cantina's shell link-preview tags, its
   * pre-rendered public pages and its sitemap name it too
   * (`vite.config.ts`); links need none.
   */
  readonly VITE_SITE_ORIGIN?: string
  /** The Cantina's base, `/build/`, which `vite.config.ts` defines (`appUrl.ts`). */
  readonly CANTINA_BASE?: string
}
