/**
 * Where `/sign-out` sends the player afterwards: the page the SRD's account
 * menu was opened on, carried in `?to=`.
 *
 * Only an address on this site or on the SRD this build links to is followed
 * (they are one origin in production; a preview or dev server runs them on
 * two), so the route cannot be used to bounce anyone to somebody else's site.
 * Anything else, or nothing, lands on the SRD's home.
 */
export function returnTo(raw: string | undefined, here: string, srdOrigin: string): string {
  const fallback = `${srdOrigin}/`
  if (!raw) return fallback
  let target: URL
  try {
    target = new URL(raw, here)
  } catch {
    return fallback
  }
  const allowed = new Set([new URL(here).origin, new URL(srdOrigin).origin])
  return allowed.has(target.origin) ? target.href : fallback
}
