/**
 * Per-route metadata for the SPA shell.
 *
 * ITUN is client-rendered, and a crawler runs no JavaScript. So anything a
 * route sets at runtime is invisible to an unfurl: every link to the app —
 * including every shared sheet — resolved to the shell's sitewide defaults.
 * Confirmed against production with a `Discordbot/2.0` user agent before this
 * existed: the root and both share-route shapes returned an identical head.
 *
 * That mattered because salvageunion.io actively promotes the feature: "sheets
 * can be shared into Discord as snapshot links". Each of those links unfurled
 * as the bare string "In The Union Now".
 *
 * ## Why a marked block and not HTMLRewriter
 *
 * `HTMLRewriter` is the idiomatic Workers answer and is **not available under
 * Bun**, where this repo's tests run. A rewriter-based implementation would be
 * unrunnable in the suite, and the routing rules it sits beside are exactly the
 * kind that have broken production before — so the testable form wins.
 *
 * `index.html` carries `<!-- itun:meta:start -->` / `<!-- itun:meta:end -->`
 * around its defaults, and this swaps that whole block. A precise delimiter
 * beats pattern-matching tags: the block is replaced wholesale, so there is no
 * chance of a per-route tag and a default tag both surviving and a parser
 * picking whichever it prefers.
 */

/** Everything the shell's meta block needs for one route. */
export type ShellMeta = {
  title: string
  description: string
  /** Absolute URL of the page being served. */
  url: string
  /** Absolute URL of the preview image. */
  image: string
}

const META_START = '<!-- itun:meta:start -->'
const META_END = '<!-- itun:meta:end -->'

/** Minimal HTML-attribute escaping. Sheet names are user-controlled. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Collapse whitespace and cap length, so a long sheet name cannot bloat the head. */
function tidy(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** Render the meta block for one route. */
export function renderMeta(meta: ShellMeta): string {
  const title = escapeAttr(tidy(meta.title, 70))
  const description = escapeAttr(tidy(meta.description, 200))
  const url = escapeAttr(meta.url)
  const image = escapeAttr(meta.image)
  return [
    META_START,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="In The Union Now" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:alt" content="${title}" />`,
    // Stated so a consumer can lay the card out before it has fetched the
    // bytes. Discord in particular decides between the small and the large
    // presentation from the metadata alone.
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    // `summary_large_image` here, `summary` in index.html, and the difference
    // is deliberate rather than drift: the sitewide default image is the
    // 512x512 app icon, which a large card would letterbox, while every image
    // this function emits is the 1200x630 rendered snapshot card. Declaring
    // `summary` for that one would render a purpose-built wide card as a small
    // square thumbnail — the whole point of rendering it, thrown away in the
    // one tag that decides how it is shown.
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<link rel="canonical" href="${url}" />`,
    META_END,
  ].join('\n    ')
}

/**
 * Swap the shell's meta block, and its `<title>`, for this route's.
 *
 * Returns the shell unchanged when the markers are absent, so a shell that
 * drifts degrades to the sitewide defaults rather than to a broken document.
 */
export function applyMeta(shell: string, meta: ShellMeta): string {
  const start = shell.indexOf(META_START)
  const end = shell.indexOf(META_END)
  if (start === -1 || end === -1 || end < start) return shell

  const withMeta = shell.slice(0, start) + renderMeta(meta) + shell.slice(end + META_END.length)

  // The <title> is outside the block (it is not `og:` metadata), and a share
  // that unfurls correctly while the browser tab says "In The Union Now" for
  // every sheet is only half the fix.
  return withMeta.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeAttr(tidy(meta.title, 70))}</title>`
  )
}

/** The `{ kind, entity }` shape `ShareStatusDialog` publishes. */
type SnapshotLike = {
  kind?: unknown
  entity?: { name?: unknown; callsign?: unknown; chassis?: unknown } | null
}

const KIND_LABEL: Record<string, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Union Crawler',
}

/**
 * Build metadata from a published snapshot.
 *
 * Defensive about the payload on purpose: it is `Record<string, unknown>` at
 * the type level, snapshots published by older builds are still readable, and
 * a snapshot that cannot be summarised must fall back rather than throw — an
 * unfurl is never worth a 500 on a page that would otherwise render.
 */
export function metaForSnapshot(
  snapshot: unknown,
  url: string,
  defaults: { image: string }
): ShellMeta | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const { kind, entity } = snapshot as SnapshotLike
  const name = typeof entity?.name === 'string' ? entity.name.trim() : ''
  if (!name) return null

  const label = typeof kind === 'string' ? (KIND_LABEL[kind] ?? 'Sheet') : 'Sheet'
  const chassis = typeof entity?.chassis === 'string' ? entity.chassis.trim() : ''

  return {
    title: `${name} — ${label}`,
    description: chassis
      ? `${label}: ${name}. Chassis: ${chassis}. A shared Salvage Union sheet on In The Union Now.`
      : `${label}: ${name}. A shared Salvage Union sheet on In The Union Now.`,
    url,
    image: defaults.image,
  }
}
