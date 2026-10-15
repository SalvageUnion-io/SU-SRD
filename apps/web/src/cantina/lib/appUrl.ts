import { basePathOf } from './site'

/**
 * The path every Cantina URL starts with, without a trailing slash: `/build`
 * (ADR-048, `site.ts`). Read from the built bundle's `BASE_URL`, which Vite
 * sets from `base`; Bun's tests have none, so they see the root.
 */
export const BASE_PATH = basePathOf(import.meta.env.BASE_URL ?? '/')

/**
 * An absolute link to a Cantina route, for a link that leaves the app: copied to
 * a clipboard, drawn as a QR code, printed on a card. In-app links go through
 * the router, which adds the base itself; this is for the ones it never sees.
 *
 * Built on the origin the page was served from, so a link copied from a
 * preview deployment opens that deployment.
 */
export function appUrl(path: string, origin: string = window.location.origin): string {
  return `${origin.replace(/\/+$/, '')}${BASE_PATH}${path}`
}

/** The app's root, absolute: `inviteUrl` and friends append a route to it. */
export function appRoot(origin: string = window.location.origin): string {
  return appUrl('', origin)
}

/**
 * The SU mark the Cantina draws in its chrome and on its link-preview cards:
 * srd's `public/` file at the site's root, which every deployment, Preview and
 * the dev server serve beside `/build/`.
 */
export const MARK_SRC = '/logos/su-cargo-dark.svg'
