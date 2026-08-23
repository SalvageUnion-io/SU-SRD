import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every URL the `/api` page documents must actually resolve.
 *
 * The page shipped a worked example that was wrong three independent ways: it
 * named a chassis ("Iron Mongrel") that exists in no data file, so its URL and
 * the `.json` beside it both 404'd; it showed `id` as a readable slug when it
 * is a UUID; and it documented `hull` / `armor`, which are not fields on
 * chassis at all. A developer following the page got a 404, and coding against
 * the documented shape meant coding against fields that never existed.
 *
 * Nothing could have caught it. Prose is not typechecked, the output snapshot
 * compares text (so a confidently-wrong example digests as happily as a right
 * one), and the fictional slug had spread into the repo's own architecture docs
 * — which made it look corroborated rather than invented.
 *
 * The samples are derived from real records now, so this asserts the property
 * that derivation is supposed to guarantee, rather than trusting that it does.
 *
 * Runs against the BUILT output, so it is skipped when `dist` is absent — a
 * missing build must not read as a pass. Run `bun --filter srd build` first.
 */

const DIST = join(import.meta.dir, '../../../dist')
const API_PAGE = join(DIST, 'api/index.html')

/** `https://salvageunion.io/schema/chassis.json` -> `schema/chassis.json` */
function toDistPath(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')
  if (!path) return 'index.html'
  // An extensionless URL is a directory index; a dotted one is a file.
  return /\.[a-z0-9]+$/i.test(path) ? path : join(path.replace(/\/$/, ''), 'index.html')
}

const built = existsSync(API_PAGE)
const html = built ? readFileSync(API_PAGE, 'utf8') : ''

describe('the /api page documents endpoints that exist', () => {
  test('the built page is present', () => {
    expect(built, `no built /api page at ${API_PAGE} — run \`bun --filter srd build\``).toBe(true)
  })

  test('every documented salvageunion.io URL maps to an emitted file', () => {
    if (!built) return
    // Both the href and the visible text, since they are written separately and
    // the visible one is what a reader copies.
    const urls = new Set(
      [...html.matchAll(/https:\/\/salvageunion\.io\/[a-z0-9\-./{}]*/gi)]
        .map((m) => m[0])
        // Placeholders like `/schema/{schemaId}.json` are illustrative, not real.
        .filter((u) => !u.includes('{'))
        .map((u) => u.replace(/[.,]$/, ''))
    )

    expect(urls.size, 'no documented URLs found — the matcher has drifted').toBeGreaterThan(2)

    const missing = [...urls].filter((u) => !existsSync(join(DIST, toDistPath(u))))
    expect(missing, 'the /api page documents URLs that 404').toEqual([])
  })

  test('the sample response shows real field names, not invented ones', () => {
    if (!built) return
    // The three that were wrong. `hull`/`armor` never existed on chassis; a
    // slug-shaped `id` misrepresents what the field holds.
    expect(html).not.toContain('"hull"')
    expect(html).not.toContain('"armor"')
    expect(html).not.toContain('iron-mongrel')

    // And at least one field that genuinely is on the chassis schema.
    expect(html).toContain('structurePoints')
  })
})
