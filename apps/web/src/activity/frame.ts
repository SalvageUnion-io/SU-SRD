/**
 * Whether this page runs in the Discord Activity's frame, and what it must do
 * there. Discord serves the frame from `<client id>.discordsays.com`, whose
 * proxy reaches this site by the portal's URL Mappings and blocks every host
 * it does not map. The Activity's own page (`./main.tsx`) and the app it opens
 * (`../main.tsx`) both run there.
 */

/** The art host the frame reaches through the `/art` URL Mapping. */
export const ART_MAPPING = { prefix: '/art', target: 'assets.salvageunion.io' } as const

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
