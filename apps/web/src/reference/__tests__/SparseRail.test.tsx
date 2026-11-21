/**
 * A sparse Page's side column (E27): every Used by and Related rules entry is
 * a real link to its page in the server's own markup, so the keyboard reaches
 * it and it works with no script. Each is a way onward, not a term: its first
 * press opens the page, and its Peek is hover's and focus's alone.
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
  test('every entry is a link to its page that Peeks on hover and opens on the first press', () => {
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
      expect(link?.hasAttribute('data-peek-press')).toBe(false)
      // In the tab order: no tabindex takes it out.
      expect(link?.hasAttribute('tabindex')).toBe(false)
    }
    expect(page.querySelector('.su-inline-ref--inert')).toBeNull()
  })

  test('a long Used by keeps a floor of rows in view; a short one gives way as before (RR2-17)', () => {
    const markup = (rail: ReturnType<typeof sparseRailFor>) =>
      renderToStaticMarkup(<SparseRail rail={rail} tone="rules" />)
    const heat = SalvageUnionReference.Keywords.getByName('Heat') as RefEntity
    const long = sparseRailFor('keywords', heat)
    expect(long.usedBy.length).toBeGreaterThan(14)
    expect(markup(long)).toContain('su-sparse-rail--long')
    expect(markup({ ...long, usedBy: long.usedBy.slice(0, 14) })).not.toContain(
      'su-sparse-rail--long'
    )
  })
})
