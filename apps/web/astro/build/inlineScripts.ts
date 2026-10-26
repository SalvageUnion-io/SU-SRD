/**
 * inlineScripts — the inline `<script>`s the CSP must name, by hash.
 *
 * Astro inlines its island runtime and each `client:*` directive into every
 * page that has an island. `public/_headers` gives `script-src` no
 * 'unsafe-inline', so the build hashes every executable inline script it
 * wrote (`./site`) into the deployed `_headers`: an inline script the build
 * did not write is still blocked. The speculation rules are hashed too: a
 * policy with hashes ignores `'inline-speculation-rules'`. JSON and JSON-LD
 * are data blocks `script-src` never gates.
 */

import { createHash } from 'node:crypto'

const DATA_SCRIPT_TYPES = new Set(['application/json', 'application/ld+json'])

/** The body of every `<script>` with no `src` whose type `script-src` gates. */
export function executableInlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?=[\s/>])([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attrs = '']) => !/\bsrc\s*=/i.test(attrs))
    .filter(([, attrs = '']) => !DATA_SCRIPT_TYPES.has(attrs.match(/\btype="([^"]*)"/i)?.[1] ?? ''))
    .map(([, , body = '']) => body)
}

/** A script body's CSP source: `'sha256-…'`. */
export function scriptHash(body: string): string {
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`
}

/**
 * `headers` (a `_headers` file) with `hashes` added to its CSP's `script-src`.
 * Throws when the file has no `script-src` to add them to.
 */
export function withScriptHashes(headers: string, hashes: readonly string[]): string {
  const policy = /^(\s*Content-Security-Policy:.*?\bscript-src [^;]*);/m
  if (!policy.test(headers)) throw new Error('[build] _headers has no CSP script-src')
  if (hashes.length === 0) return headers
  return headers.replace(policy, (_, head: string) => `${head} ${[...hashes].sort().join(' ')};`)
}
