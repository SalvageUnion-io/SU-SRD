import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { NAV_CATALOG } from '../../src/generated/navCatalog'
import { renderNavCatalogModule } from '../genNavCatalog'

/**
 * `src/generated/navCatalog.ts` is generated and COMMITTED (like the reference
 * package's `schemas/*.schema.json`), so tests, typecheck and the dev server
 * work without a prior build.
 *
 * A committed generated file rots silently: add a schema to the catalog and the
 * mobile nav drawer keeps rendering the old one, correctly, forever. Nothing
 * else would notice — the drawer was never in the retired parity gate's `<main>`
 * scope, and an out-of-date-but-valid catalog throws no error. This test is the
 * guard, and now the only one.
 */
describe('generated nav catalog', () => {
  it('matches what ssg/genNavCatalog.ts would write today', async () => {
    const committedPath = fileURLToPath(
      new URL('../../src/generated/navCatalog.ts', import.meta.url)
    )
    const committed = await readFile(committedPath, 'utf-8')
    const regenerated = await renderNavCatalogModule()

    expect(regenerated).toBe(committed)
  })

  it('carries the catalog the drawer actually renders', () => {
    // Cheap shape assertions, so a corrupted-but-parseable file is caught even
    // if the generator changed in lockstep with it.
    expect(NAV_CATALOG.length).toBeGreaterThan(0)
    for (const section of NAV_CATALOG) {
      expect(section.label).toBeTruthy()
      expect(section.schemas.length).toBeGreaterThan(0)
      for (const schema of section.schemas) {
        expect(schema.href).toStartWith('/schema/')
      }
    }
  })
})
