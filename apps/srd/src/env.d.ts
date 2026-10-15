/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Deployed commit SHA, set by `deploy-cloudflare.yml`. Sent with each error
   * report (see src/lib/observability.ts) so an error maps back to a deploy.
   * Unset in local dev — the release tag is simply omitted.
   */
  readonly VITE_COMMIT_REF?: string
  /**
   * A Worker Preview's own origin (`https://pr-<n>-su-srd.<account>.workers.dev`),
   * set by `deploy-preview.yml`. Unset → production's. See `SITE_URL`.
   */
  readonly VITE_SRD_ORIGIN?: string
  /**
   * The same Preview's Cantina origin, which every Cantina link then points at.
   * Unset → production's. See `CANTINA_URL`.
   */
  readonly VITE_CANTINA_ORIGIN?: string
}
