import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE_SECURITY_HEADERS } from '../worker'

/**
 * The one place the two sources of the base security headers are held together.
 * salvageunion.io (the reference site and the app) sends them from the `/*` block of
 * `apps/web/public/_headers`; this Worker builds its own responses and sends
 * `BASE_SECURITY_HEADERS`. A header changed in one and not the other fails here.
 */

const REPO = join(import.meta.dir, '..', '..', '..', '..')

/** The headers of the `/*` rule, names lowercased, comments dropped. */
function rootRule(file: string): Record<string, string> {
  const lines = readFileSync(join(REPO, file), 'utf-8').split('\n')
  const start = lines.indexOf('/*')
  if (start === -1) throw new Error(`${file} has no /* rule`)
  const headers: Record<string, string> = {}
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) continue
    const colon = trimmed.indexOf(':')
    headers[trimmed.slice(0, colon).toLowerCase()] = trimmed.slice(colon + 1).trim()
  }
  return headers
}

describe('base security headers', () => {
  it('match apps/web/public/_headers', () => {
    const { 'content-security-policy': _csp, ...base } = rootRule('apps/web/public/_headers')
    expect(base).toEqual({ ...BASE_SECURITY_HEADERS })
  })
})
