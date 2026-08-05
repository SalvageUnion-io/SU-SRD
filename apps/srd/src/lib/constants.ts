// Re-exported, not re-declared. This origin was hardcoded in four places
// (here, itun's deep-link builder, and twice inside the Discord bot); the
// dataset owns it now, beside ASSET_BASE_URL, so a domain change is one edit.
export { SRD_SITE_URL as SITE_URL } from 'salvageunion-reference'

/** In The Union Now — the companion character builder & game manager. */
export const ITUN_URL = 'https://intheunionnow.com'

/** Default OG image path — the 1200×630 branded card. */
export const DEFAULT_OG_IMAGE = '/og-image.png'
