/**
 * Compute the `script-src` hashes for srd's CSP from the HTML it just emitted.
 *
 * ## Why this is generated and not written down
 *
 * srd's CSP carried `script-src 'unsafe-inline'`, which removes CSP's primary
 * XSS control: with it present, an injected `<script>` executes. The site is
 * static, so there is no request to attach a nonce to — the alternative is
 * hashes, and hashes are only safe if they cannot drift from the scripts they
 * describe.
 *
 * A hardcoded list in `public/_headers` would drift the first time one of those
 * scripts changed by a character, and the failure mode is silent-ish and
 * confusing: the CSP still looks strict, the script is simply blocked, and the
 * page degrades in whatever way that script existed to prevent. So the list is
 * derived from `dist/` after rendering, and the build FAILS if the placeholder
 * it substitutes into is missing.
 *
 * The generated `_headers` is content-digested by `ssg/snapshot.ts`, so a
 * changed hash shows up as a snapshot diff and gets read in review rather than
 * landing unnoticed.
 *
 * ## What is and is not hashed
 *
 * Only scripts the browser EXECUTES. `application/ld+json` (JSON-LD),
 * `application/json` (island props) and any other non-JS type are **data
 * blocks**: the browser does not execute them and `script-src` does not gate
 * them. Hashing them would be noise that churns on every content edit.
 *
 * `type="speculationrules"` IS gated, and cannot be hashed — Chrome requires
 * the `'inline-speculation-rules'` source expression instead, which is what
 * `_headers` carries. Browsers that do not know the keyword ignore it, and
 * those are exactly the browsers with no speculation-rules support to lose.
 *
 * Measured at the time of writing: 1,039 pages, **3** distinct executable
 * inline scripts — the `js`-class snippet on every page, plus one each on
 * `/about` and `/greembeem`.
 */

import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The token in `public/_headers` this replaces. */
export const CSP_HASH_PLACEHOLDER = '__SRD_INLINE_SCRIPT_HASHES__'

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const TYPE_RE = /\btype\s*=\s*["']([^"']+)["']/i
const SRC_RE = /\bsrc\s*=\s*["']/i

/** Script types the browser executes as JavaScript. */
const EXECUTABLE = new Set(['', 'module', 'text/javascript', 'application/javascript'])

function isExecutableInline(attrs: string): boolean {
  if (SRC_RE.test(attrs)) return false
  const type = attrs.match(TYPE_RE)?.[1]?.trim().toLowerCase() ?? ''
  return EXECUTABLE.has(type)
}

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)))
    else if (entry.name.endsWith('.html')) out.push(path)
  }
  return out
}

/** Every distinct executable inline script in `distDir`, as CSP hash sources. */
export async function collectInlineScriptHashes(distDir: string): Promise<string[]> {
  const hashes = new Set<string>()
  for (const file of await htmlFiles(distDir)) {
    const html = await readFile(file, 'utf-8')
    for (const [, attrs, body] of html.matchAll(SCRIPT_RE)) {
      if (!isExecutableInline(attrs ?? '')) continue
      // The hash is over the element's text content exactly as it appears —
      // no trimming. A stray change in whitespace changes the hash, which is
      // correct: it is a different script as far as the browser is concerned.
      hashes.add(
        `'sha256-${createHash('sha256')
          .update(body ?? '')
          .digest('base64')}'`
      )
    }
  }
  return [...hashes].sort()
}

/**
 * Substitute the hashes into `dist/_headers`.
 *
 * Throws rather than warning on a missing placeholder. A build that silently
 * shipped `_headers` with the literal token in it would serve a CSP naming a
 * nonexistent source and block every inline script on the site.
 */
export async function writeCspHeaders(distDir: string): Promise<number> {
  const headersPath = join(distDir, '_headers')
  const source = await readFile(headersPath, 'utf-8')

  if (!source.includes(CSP_HASH_PLACEHOLDER)) {
    throw new Error(
      `[ssg] ${headersPath} does not contain ${CSP_HASH_PLACEHOLDER}.\n` +
        "  srd's script-src is generated from the inline scripts actually emitted, so the\n" +
        '  placeholder must be present in apps/srd/public/_headers. If you removed it to\n' +
        "  hardcode hashes, don't — they drift, and a stale hash blocks the script silently."
    )
  }

  const hashes = await collectInlineScriptHashes(distDir)
  if (hashes.length === 0) {
    throw new Error(
      '[ssg] found no executable inline scripts to hash, which is not a state this site has.\n' +
        '  Every page carries the `js`-class snippet. Zero means the scan matched nothing —\n' +
        '  a changed emit shape, or a dist that was not rendered — and substituting an empty\n' +
        '  hash list would ship a CSP that blocks it.'
    )
  }

  await writeFile(headersPath, source.replaceAll(CSP_HASH_PLACEHOLDER, hashes.join(' ')), 'utf-8')
  return hashes.length
}
