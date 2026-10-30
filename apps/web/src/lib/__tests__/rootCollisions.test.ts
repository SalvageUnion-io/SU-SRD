/**
 * The reference owns the site's root: a listing at `/<schema>/`, its pages
 * below (ADR-062 §1). Everything else at the root is reserved, so a schema
 * whose id takes one of those names would shadow a page, the app, a file or a
 * redirect, or be shadowed by it. The reserved roots are read from where they
 * live (the page directory, `public/`, the app's Worker-first roots), so a new
 * site page is covered the day it lands.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RUN_WORKER_FIRST } from '../../worker/app'
import { currentPathFor, formerSitePath, retiredSitePage } from '../redirects'
import { getItemStaticPaths, getSchemaStaticPaths } from '../staticPaths'

const WEB = join(import.meta.dir, '../../..')

/** A directory's entries as root path segments: extensions off, dynamic routes out. */
function rootsIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => !name.startsWith('[') && !name.startsWith('_') && !name.startsWith('.'))
    .map((name) => name.replace(/\.[a-z.]+$/, ''))
}

const RESERVED = new Set([
  ...rootsIn(join(WEB, 'astro/pages')),
  ...rootsIn(join(WEB, 'public')),
  ...RUN_WORKER_FIRST.map((pattern) => pattern.split('/')[1]),
])

/** Whether a path is answered by a redirect before it can reach a page. */
function redirected(path: string): boolean {
  return [currentPathFor(path), formerSitePath(path), retiredSitePage(path)].some(Boolean)
}

describe('reference roots', () => {
  const schemaIds = getSchemaStaticPaths().map((path) => path.params.schemaId)

  it('reads the reserved roots', () => {
    for (const root of ['build', 'play', 'api', 'bot', 'schema', 'about', 'favicons']) {
      expect(RESERVED).toContain(root)
    }
  })

  it('gives no schema a root the site already uses', () => {
    expect(schemaIds.filter((id) => RESERVED.has(id))).toEqual([])
  })

  it('lets no redirect claim a listing or an entity page', () => {
    const pages = [
      ...schemaIds.map((id) => `/${id}/`),
      ...getItemStaticPaths().map(({ params }) => `/${params.schemaId}/${params.itemId}/`),
    ]
    expect(pages.filter(redirected)).toEqual([])
  })
})
