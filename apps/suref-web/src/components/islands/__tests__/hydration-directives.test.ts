import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const srcDir = resolve(import.meta.dir, '../../../..')

function readAstroFile(relativePath: string): string {
  return readFileSync(resolve(srcDir, relativePath), 'utf-8')
}

describe('hydration directives', () => {
  describe('below-fold islands use client:visible', () => {
    it('ReferenceEntityIsland in item page uses client:visible', () => {
      const content = readAstroFile('src/pages/schema/[schemaId]/item/[itemId].astro')
      expect(content).toContain('ReferenceEntityIsland')
      expect(content).toContain('client:visible')
      expect(content).not.toMatch(/ReferenceEntityIsland[^>]*client:idle/)
      expect(content).not.toMatch(/ReferenceEntityIsland[^>]*client:load/)
    })

    it('SchemaViewerIsland in schema index page uses client:visible', () => {
      const content = readAstroFile('src/pages/schema/[schemaId]/index.astro')
      expect(content).toContain('SchemaViewerIsland')
      expect(content).toContain('client:visible')
      expect(content).not.toMatch(/SchemaViewerIsland[^>]*client:idle/)
      expect(content).not.toMatch(/SchemaViewerIsland[^>]*client:load/)
    })
  })

  describe('above-fold critical islands retain client:idle', () => {
    it('SearchIsland in TopNavigation retains client:idle', () => {
      const content = readAstroFile('src/components/TopNavigation.astro')
      expect(content).toContain('SearchIsland')
      expect(content).toMatch(/SearchIsland[^\n]*client:idle|client:idle[^\n]*SearchIsland/)
    })

    it('MobileNavIsland in TopNavigation retains client:idle', () => {
      const content = readAstroFile('src/components/TopNavigation.astro')
      expect(content).toContain('MobileNavIsland')
      expect(content).toMatch(
        /MobileNavIsland[\s\S]{0,100}client:idle|client:idle[\s\S]{0,100}MobileNavIsland/
      )
    })

    it('Toaster in BaseLayout uses client:visible', () => {
      const content = readAstroFile('src/layouts/BaseLayout.astro')
      expect(content).toContain('Toaster')
      expect(content).toMatch(/Toaster[^\n]*client:visible|client:visible[^\n]*Toaster/)
    })
  })
})
