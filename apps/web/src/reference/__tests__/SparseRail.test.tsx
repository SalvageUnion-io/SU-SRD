/**
 * A sparse Page's side column (E27): every Used by and Related rules entry is
 * a real link to its page in the server's own markup, so the keyboard reaches
 * it and it works with no script, and each is a term whose press Peeks.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { sparseRailFor } from '../../lib/sparseRail'
import { SparseRail } from '../SparseRail'

const explosive = () => {
  const trait = SalvageUnionReference.Traits.getByName('Explosive')
  if (!trait) throw new Error('Explosive fixture missing')
  return trait as RefEntity
}

describe('SparseRail', () => {
  test('every entry is a link to its page, and a term (data-peek-press)', () => {
    const rail = sparseRailFor('traits', explosive())
    expect(rail.usedBy.length).toBeGreaterThan(0)
    const html = renderToStaticMarkup(<SparseRail rail={rail} tone="rules" />)
    const page = document.createElement('div')
    page.innerHTML = html
    const entries = [...page.querySelectorAll('.su-sparse-rail__row, .su-sparse-rail__list > li')]
    expect(entries.length).toBe(rail.usedBy.length + rail.rules.length)
    for (const entry of entries) {
      const link = entry.querySelector('a')
      expect(link?.getAttribute('href')).toMatch(/^\/[a-z-]+\/[a-z0-9-]+\/$/)
      expect(link?.hasAttribute('data-peek')).toBe(true)
      expect(link?.hasAttribute('data-peek-press')).toBe(true)
      // In the tab order: no tabindex takes it out.
      expect(link?.hasAttribute('tabindex')).toBe(false)
    }
    expect(page.querySelector('.su-inline-ref--inert')).toBeNull()
  })
})
