/**
 * What the Worker's JSON routes say when they refuse (`../sharedRoutes.ts`,
 * `../photos.ts`): the words a player reads, kept beside the shared database's
 * own, as the rooms keep theirs.
 */

export const REFUSALS = {
  signIn: 'Sign in first',
  adminsOnly: 'Only a site admin can do that',
  notFound: 'Not found',
  unreadable: 'That could not be read. Try again.',
  photosUnset: 'Photos are not set up here',
  notAPhoto: 'A photo must be a WebP, JPEG or PNG image under 4 MB.',
  crossOrigin: 'Send that from this site',
} as const

/**
 * The Discord Activity's origin. Discord serves its frame from
 * `<client id>.discordsays.com` and proxies it to this Worker (the portal's
 * URL Mappings), so the frame's requests arrive with that origin.
 */
export function activityOrigin(clientId: string): string {
  return `https://${clientId}.discordsays.com`
}

/**
 * Whether a cookie-signed write came from another site's page, which the
 * routes refuse, as the sign-in routes do: the cookie alone must not report,
 * hide or upload for anyone. This site's own pages are not another site, and
 * neither is its Discord Activity, when `clientId` names it.
 */
export function crossOrigin(request: Request, clientId?: string): boolean {
  const origin = request.headers.get('origin')
  if (origin === new URL(request.url).origin) return false
  return clientId === undefined || clientId === '' || origin !== activityOrigin(clientId)
}

/**
 * A path segment decoded, or null for a malformed escape (`%E0%A4`), which
 * the routes answer as not found rather than throwing.
 */
export function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/** A file whose address is never reused: any cache may keep it for a year. */
export const IMMUTABLE = 'public, max-age=31536000, immutable'
