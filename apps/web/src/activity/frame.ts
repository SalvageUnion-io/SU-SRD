/**
 * Whether this page runs in the Discord Activity's frame, and what it must do
 * there. Discord serves the frame from `<client id>.discordsays.com`, whose
 * proxy reaches this site by the portal's URL Mappings and blocks every host
 * it does not map. The app runs there as the Activity (`../main.tsx`,
 * `./ActivityBoot.tsx`).
 */

import { routeInApp } from 'game-domain/appAddress'

/** The art host the frame reaches through the `/art` URL Mapping. */
const ART_MAPPING = { prefix: '/art', target: 'assets.salvageunion.io' } as const

/** Whether a page at this host is in the Activity's frame. */
export function inActivityFrame(hostname: string): boolean {
  return hostname.endsWith('.discordsays.com')
}

/**
 * In the frame, sends the art host's requests and `src` attributes through
 * the `/art` URL Mapping. The SDK loads only there.
 */
export async function mapActivityUrls(hostname: string): Promise<void> {
  if (!inActivityFrame(hostname)) return
  const { patchUrlMappings } = await import('@discord/embedded-app-sdk')
  patchUrlMappings([ART_MAPPING], { patchSrcAttributes: true })
}

/**
 * Where a pressed link goes in the Activity: a route of the app, or a page
 * outside it, made absolute on the site (the frame's own origin is Discord's
 * proxy, which a browser outside Discord cannot open).
 */
export function activityLinkTarget(
  href: string,
  frameOrigin: string,
  siteOrigin: string
): { kind: 'route'; path: string } | { kind: 'outside'; url: string } | null {
  let url: URL
  try {
    url = new URL(href, frameOrigin)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.origin !== frameOrigin) return { kind: 'outside', url: url.href }
  const path = `${url.pathname}${url.search}${url.hash}`
  if (routeInApp(url.pathname) !== null) return { kind: 'route', path }
  return { kind: 'outside', url: `${siteOrigin}${path}` }
}
