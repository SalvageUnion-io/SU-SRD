import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const srcDir = resolve(import.meta.dir, '../../../..')

function readAstroFile(relativePath: string): string {
  return readFileSync(resolve(srcDir, relativePath), 'utf-8')
}

/**
 * Just the markup of an `.astro` file — everything after the closing `---` of
 * its frontmatter.
 *
 * Hydration directives only mean anything in the template, and these guards
 * assert on the ABSENCE of things. Matching the raw file would let a prose
 * comment explaining why an island was removed fail the very test asserting it
 * is gone, so the two halves are read separately.
 */
function readAstroTemplate(relativePath: string): string {
  const content = readAstroFile(relativePath)
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/)
  return match?.[1] ?? content
}

describe('hydration directives', () => {
  describe('the entity card is server-rendered unless it needs a listener', () => {
    // Most SRD entities are documents and render to HTML at build time with no
    // JS. Only cards that emit something needing a click handler keep the
    // island. Both halves of that are load-bearing: dropping the island for an
    // interactive card leaves a rendered-but-dead control, and hydrating a
    // static one re-introduces the React #418 mismatch that `useGameData`'s
    // hardcoded-false server snapshot exists to prevent.
    it('EntityView preloads the ORM and branches on cardNeedsHydration', () => {
      const content = readAstroFile('src/components/EntityView.astro')
      expect(content).toMatch(/await\s+SalvageUnionReference\.preload\(/)
      expect(content).toMatch(/cardNeedsHydration\(/)
    })

    it('the static path carries no client directive', () => {
      const template = readAstroTemplate('src/components/EntityView.astro')
      const staticBranch = template.slice(template.indexOf('EntityCardStatic'))
      expect(staticBranch).not.toMatch(/client:(load|idle|visible|only|media)/)
    })

    it('the interactive path keeps client:visible and its no-JS fallback', () => {
      const template = readAstroTemplate('src/components/EntityView.astro')
      expect(template).toMatch(/ReferenceEntityIsland[\s\S]{0,160}client:visible/)
      expect(template).toContain('StaticEntityContent')
    })
  })

  describe('below-fold islands use client:visible', () => {
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

    it('Toaster is not imported or rendered in BaseLayout', () => {
      const content = readAstroFile('src/layouts/BaseLayout.astro')
      expect(content).not.toContain('Toaster')
    })
  })
})
