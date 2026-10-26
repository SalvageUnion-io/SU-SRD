/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />

interface ImportMetaEnv {
  /**
   * Deployed commit SHA, set by `deploy-cloudflare.yml`. Sent with each error
   * report (see src/lib/observability.ts) so an error maps back to a deploy.
   * Unset in local dev — the release tag is simply omitted.
   */
  readonly VITE_COMMIT_REF?: string
  /**
   * A Worker Preview's own origin (`https://pr-<n>-su-srd.<account>.workers.dev`),
   * set by `deploy-preview.yml`; the dev server's, by `astro.config.ts`. Unset →
   * production's. See `SITE_URL`. The app's shell link-preview tags, its
   * pre-rendered public pages and its sitemap name it too
   * (`astro.config.ts`); links need none.
   */
  readonly VITE_SITE_ORIGIN?: string
}
