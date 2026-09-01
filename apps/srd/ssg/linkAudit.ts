/**
 * Refuse to emit a page that links to an entity by UUID.
 *
 * `CLAUDE.md`'s Data Conventions state it plainly — *"Entity links must use
 * slugs, never UUIDs. Example: `/chassis/iron-mongrel` not
 * `/chassis/550e8400-e29b...`"* — and nothing enforced it. A grep of `tools/`
 * turns up no slug or UUID check anywhere.
 *
 * The failure is not cosmetic and not self-correcting. A UUID URL is a real,
 * resolvable-looking link that search engines index, readers bookmark, and
 * `llms.txt` consumers follow — and the id is an internal identifier that
 * carries no meaning and can change when data is regenerated. Once one is
 * indexed, removing it is a broken link rather than a tidy-up.
 *
 * Run over the built HTML rather than the source, because that is where the
 * property actually holds or fails: the same helper can produce a slug for one
 * entity and fall back to an id for another whose slug is missing, and only the
 * output shows which. It throws during `ssg/build.ts` rather than reporting
 * afterwards — the site should not be publishable in that state.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Canonical 8-4-4-4-12 hex UUID, anywhere inside a same-origin href. */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_HREF = new RegExp(`href=["'](/[^"']*${UUID}[^"']*)["']`, 'gi')

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)))
    else if (entry.name.endsWith('.html')) out.push(path)
  }
  return out
}

export type UuidLink = { file: string; href: string }

export async function findUuidLinks(distDir: string): Promise<UuidLink[]> {
  const found: UuidLink[] = []
  for (const file of await htmlFiles(distDir)) {
    const html = await readFile(file, 'utf-8')
    for (const match of html.matchAll(UUID_HREF)) {
      found.push({ file, href: match[1] as string })
    }
  }
  return found
}

/** Throws if any emitted page links to an entity by UUID. */
export async function assertNoUuidLinks(distDir: string): Promise<void> {
  const links = await findUuidLinks(distDir)
  if (links.length === 0) return

  const shown = links.slice(0, 10)
  throw new Error(
    `[ssg] refusing to finish: ${links.length} link(s) address an entity by UUID.\n` +
      shown.map(({ file, href }) => `  ${file}\n    -> ${href}`).join('\n') +
      (links.length > shown.length ? `\n  ...and ${links.length - shown.length} more\n` : '\n') +
      '\n  Entity links must use slugs (/chassis/iron-mongrel), never ids\n' +
      '  (/chassis/550e8400-...). The id is internal, carries no meaning, and can\n' +
      '  change when data is regenerated — but a published URL cannot.\n\n' +
      '  This usually means a link helper fell back to `.id` because `.slug` was\n' +
      '  missing on that entity. Fix the data rather than the link.\n'
  )
}
