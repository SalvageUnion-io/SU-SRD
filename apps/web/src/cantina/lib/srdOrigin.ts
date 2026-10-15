import { SRD_SITE_URL } from 'salvageunion-reference'

/**
 * The SRD this build links to, without a trailing slash: production's
 * (`SRD_SITE_URL`), or on a Worker Preview the same PR's SRD Preview, which
 * `deploy-preview.yml` passes as `VITE_SRD_ORIGIN`, or in dev the local srd
 * server (`vite.cantina.config.ts`). Every Cantina link into the
 * SRD (deep links, the doc pages, the Union bar's Reference) is built on it.
 *
 * `?.`: the Worker bundles this module too (`docPages.ts`), and outside Vite
 * `import.meta.env` is undefined, so its redirects go to production's SRD.
 */
export const SRD_ORIGIN = (import.meta.env?.VITE_SRD_ORIGIN || SRD_SITE_URL).replace(/\/+$/, '')
