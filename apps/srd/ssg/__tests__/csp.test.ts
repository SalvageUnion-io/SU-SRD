import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CSP_HASH_PLACEHOLDER, collectInlineScriptHashes, writeCspHeaders } from '../csp'

/**
 * srd's `script-src` is generated from the HTML the build actually emitted,
 * because the alternative — a hardcoded hash list — drifts the moment a script
 * changes by a character, and a stale hash fails in the worst way available: the
 * CSP still reads as strict, the script is simply blocked, and the page degrades
 * in whatever way that script existed to prevent.
 *
 * These tests hold the two properties that make the generator trustworthy: it
 * hashes exactly what the browser executes, and it refuses rather than shipping
 * a CSP it cannot vouch for.
 */

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'srd-csp-'))
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), body, 'utf-8')
  }
  return dir
}

describe('collectInlineScriptHashes', () => {
  test('hashes an executable inline script', async () => {
    const dir = await fixture({ 'a.html': "<script>alert('x')</script>" })
    // Cross-checked against `openssl dgst -sha256 -binary | openssl base64` and
    // Python's hashlib, not against this implementation — a literal copied from
    // the code under test pins nothing. This is the encoding the browser uses:
    // base64 of the RAW digest over the element's exact text.
    expect(await collectInlineScriptHashes(dir)).toEqual([
      "'sha256-JPoFjrDvGjII2ZQr0zVCLdwImped9XUzr7nzeL7Ser0='",
    ])
  })

  test('ignores data blocks — the browser never executes them', async () => {
    // JSON-LD is on 797 of 1,039 pages and island props on 120. Hashing them
    // would add churn on every content edit and buy nothing: `script-src` does
    // not gate a non-JavaScript script type.
    const dir = await fixture({
      'a.html': [
        '<script type="application/ld+json">{"@type":"Thing"}</script>',
        '<script type="application/json" data-island-props>{"a":1}</script>',
        '<script type="speculationrules">{"prerender":[]}</script>',
      ].join('\n'),
    })
    expect(await collectInlineScriptHashes(dir)).toEqual([])
  })

  test('ignores external scripts', async () => {
    const dir = await fixture({ 'a.html': '<script type="module" src="/x.js"></script>' })
    expect(await collectInlineScriptHashes(dir)).toEqual([])
  })

  test('deduplicates the same script across pages and sorts the result', async () => {
    // The js-class snippet is on all 1,039 pages; the CSP needs it once.
    const dir = await fixture({
      'a.html': '<script>b()</script>',
      'b.html': '<script>b()</script>',
      'c.html': '<script>a()</script>',
    })
    const hashes = await collectInlineScriptHashes(dir)
    expect(hashes).toHaveLength(2)
    expect([...hashes].sort()).toEqual(hashes)
  })

  test('distinguishes scripts that differ only in whitespace', async () => {
    // Not pedantry: the browser hashes the element text exactly, so a build
    // that reformats a script and a CSP that did not notice would block it.
    const dir = await fixture({
      'a.html': '<script>a()</script>',
      'b.html': '<script>a() </script>',
    })
    expect(await collectInlineScriptHashes(dir)).toHaveLength(2)
  })
})

describe('writeCspHeaders', () => {
  test('substitutes the hashes and leaves no placeholder behind', async () => {
    const dir = await fixture({
      'a.html': '<script>a()</script>',
      _headers: `/*\n  Content-Security-Policy: script-src ${CSP_HASH_PLACEHOLDER} 'self';\n`,
    })
    const count = await writeCspHeaders(dir)
    const written = await readFile(join(dir, '_headers'), 'utf-8')

    expect(count).toBe(1)
    expect(written).not.toContain(CSP_HASH_PLACEHOLDER)
    expect(written).toContain("'sha256-")
    expect(written).not.toContain("'unsafe-inline'")
  })

  test('throws when the placeholder is missing', async () => {
    // Shipping `_headers` with the token still in it would name a source that
    // does not exist and block every inline script on the site, so this refuses
    // rather than warning.
    const dir = await fixture({
      'a.html': '<script>a()</script>',
      _headers: "/*\n  Content-Security-Policy: script-src 'self';\n",
    })
    expect(writeCspHeaders(dir)).rejects.toThrow(/does not contain/)
  })

  test('throws when there is nothing to hash', async () => {
    // Every page of this site carries the js-class snippet, so zero means the
    // scan matched nothing — a changed emit shape, or an unrendered dist — and
    // substituting an empty list would ship a CSP that blocks it.
    const dir = await fixture({
      'a.html': '<p>no scripts</p>',
      _headers: `/*\n  Content-Security-Policy: script-src ${CSP_HASH_PLACEHOLDER} 'self';\n`,
    })
    expect(writeCspHeaders(dir)).rejects.toThrow(/no executable inline scripts/)
  })
})
