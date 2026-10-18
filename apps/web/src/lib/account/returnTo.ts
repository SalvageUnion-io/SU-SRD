/**
 * Where `/sign-out` sends the player afterwards: the page the SRD's account
 * menu was opened on, carried in `?to=`.
 *
 * Only an address on this site (the SRD and the app are one origin) is
 * followed, so the route cannot be used to bounce anyone to somebody else's
 * site. Anything else, or nothing, lands on the SRD's home.
 */
export function returnTo(raw: string | undefined, here: string): string {
  const fallback = new URL('/', here).href
  if (!raw) return fallback
  let target: URL
  try {
    target = new URL(raw, here)
  } catch {
    return fallback
  }
  return target.origin === new URL(here).origin ? target.href : fallback
}
