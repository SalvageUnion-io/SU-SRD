/**
 * The short, readable last segment of a shared thing's address:
 * `/p/pilot/rook-vance-0a1b2c3d4e5f` rather than the full app id.
 *
 * The segment is the name as a slug, then the first {@link SHORT_ID_LENGTH} hex
 * digits of the app id. Only the hex digits address anything: the slug is
 * decoration, so a rename never breaks a link, and nothing new is stored. A
 * full app id still works as the segment, so every old link keeps resolving.
 *
 * Forty-eight bits keep ADR-032's "you can read one you have the URL for; you
 * cannot discover one": against even a large shelf of published sheets, a
 * guessed short id hits one about once in billions of tries.
 *
 * Imports nothing, like `entityKinds`, so the Discord bot can read it.
 */

/** Hex digits of the app id a short address carries. */
const SHORT_ID_LENGTH = 12

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHORT_TAIL = new RegExp(`(?:^|-)([0-9a-f]{${SHORT_ID_LENGTH}})$`, 'i')
const SLUG_MAX = 40

/** A name as an address slug: `Rook "Ironside" Vance` → `rook-ironside-vance`. */
export function slugOfName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length <= SLUG_MAX) return slug
  const cut = slug.slice(0, SLUG_MAX)
  const lastBreak = cut.lastIndexOf('-')
  return lastBreak > 0 ? cut.slice(0, lastBreak) : cut
}

/**
 * The address segment for a thing: `<slug>-<short id>`, the bare short id
 * when the name slugs to nothing, or the app id itself when it is not a UUID
 * (a short id of one would not resolve back to it).
 */
export function shareSegment(appId: string, name?: string): string {
  if (!UUID.test(appId)) return appId
  const short = appId.replace(/-/g, '').slice(0, SHORT_ID_LENGTH).toLowerCase()
  const slug = name ? slugOfName(name) : ''
  return slug ? `${slug}-${short}` : short
}

/** What an address segment names: an exact app id, or the prefix of one. */
export type ParsedSegment =
  | { readonly kind: 'appId'; readonly appId: string }
  | { readonly kind: 'prefix'; readonly prefix: string }

/**
 * Read an address segment. A full UUID is itself; a segment ending in
 * {@link SHORT_ID_LENGTH} hex digits names the app id they begin, as the
 * UUID-shaped prefix `0a1b2c3d-4e5f`; anything else is taken whole, as an
 * app id that predates UUIDs. A reader of a prefix that finds nothing falls
 * back to the whole segment, so such an id that happens to end in hex still
 * resolves.
 */
export function parseShareSegment(segment: string): ParsedSegment {
  if (UUID.test(segment)) return { kind: 'appId', appId: segment }
  const tail = SHORT_TAIL.exec(segment)?.[1]
  if (tail === undefined) return { kind: 'appId', appId: segment }
  const hex = tail.toLowerCase()
  return { kind: 'prefix', prefix: `${hex.slice(0, 8)}-${hex.slice(8)}` }
}

/** Whether `appId` is the one `segment` names. */
export function segmentNames(segment: string, appId: string): boolean {
  const parsed = parseShareSegment(segment)
  return parsed.kind === 'appId'
    ? parsed.appId === appId
    : appId.toLowerCase().startsWith(parsed.prefix) || appId === segment
}
