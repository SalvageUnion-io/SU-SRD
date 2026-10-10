/**
 * THE CARD AS A PAGE (#1254, boards 07 and 08) — `presentation="page"`.
 *
 * Rendered through the real card with real SRD data:
 * - no frame, seam, header or footer: the page's chapter band carries the
 *   title, so the card prints no heading of its own;
 * - the line art is the hero, and the stat column is the book's, in its order
 *   and its words (`buildBookStats`);
 * - a chassis ability is a framed card stamped "Chassis Ability";
 * - a basic chassis's patterns are full-width link rows with a "Show all"
 *   link for a phone;
 * - what the page's bands say comes from the card's own helpers
 *   (`resolveEntityPageMeta`).
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { getTechLevel, SalvageUnionReference } from 'salvageunion-reference'
import { PatternHrefProvider } from '../../entityHrefContext'
import { buildBookStats } from '../../referenceEntityStatsConfig'
import { resolveEntityPageMeta } from '../entityPage'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const gopher = () => need(SalvageUnionReference.Chassis.getByName('Gopher'), 'gopher')
const juryRig = () => need(SalvageUnionReference.Abilities.getByName('Jury Rig'), 'jury rig')

const patternHref = () => '/pattern/'

describe('buildBookStats — the stat column in the book’s words and order', () => {
  test('a chassis reads the manual’s eight, in its order', () => {
    const chassis = gopher()
    const stats = buildBookStats(chassis, { techLevel: getTechLevel(chassis) })
    expect(stats.map((s) => s.label)).toEqual([
      'Structure Pts.',
      'Energy Pts.',
      'Heat Cap.',
      'System Slots',
      'Module Slots',
      'Cargo Cap.',
      'Tech Level',
      'Salvage Value',
    ])
    expect(stats[0]?.value).toBe(String(chassis.structurePoints))
  })

  test('drops what the entity does not carry, and the TL when it has none', () => {
    const stats = buildBookStats(juryRig(), {})
    expect(stats.map((s) => s.label)).not.toContain('Tech Level')
    expect(stats.map((s) => s.label)).not.toContain('Structure Pts.')
  })
})

describe('resolveEntityPageMeta — what the page’s bands say', () => {
  test('a chassis: its type stamp, TL and citation with its reprint', () => {
    const meta = resolveEntityPageMeta(gopher())
    expect(meta.typeLabel).toBe('Chassis')
    expect(meta.techLevel).toBe('2')
    expect(meta.page).toBe(gopher().page)
    expect(meta.citation).toStartWith('Salvage Union Workshop Manual')
    expect(meta.citation).toContain('also in Salvage Union Starter Set (PC) · p.26')
  })

  test('an ability: its tree on the type stamp, its tier numeral and its cost', () => {
    const ability = juryRig()
    const meta = resolveEntityPageMeta(ability)
    expect(meta.typeLabel).toContain('Tree')
    expect(meta.numeral).toBe(String(ability.level))
    expect(meta.cost).toBe('2 AP')
  })

  test('a pattern is stamped "Pattern" and cites its own book when it has one', () => {
    const chassis = gopher()
    const pattern = need(chassis.patterns?.[0], 'gopher pattern')
    expect(resolveEntityPageMeta(chassis, pattern).typeLabel).toBe('Pattern')
  })
})

describe('the card as a page', () => {
  test('prints no title, seam or footer of its own: the page’s bands carry them', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    // The page body is the whole render: no card frame around it.
    expect(container.firstElementChild?.className).toBe('su-entity-page')
    expect(container.querySelector('h1')).toBeNull()
    // The only header fills are the framed chassis ability's, not the entity's.
    for (const fill of container.querySelectorAll('[data-fill]')) {
      expect(fill.closest('.su-entity-page__lead')).not.toBeNull()
    }
    expect(container.textContent).not.toContain('Salvage Union Workshop Manual')
  })

  test('the line art is the hero, beside the right column', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    expect(container.querySelector('.su-entity-page__main--art')).not.toBeNull()
    expect(container.querySelector('.su-entity-page__art img')).not.toBeNull()
  })

  test('the stat column reads the book’s labels, one cell per stat', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const column = container.querySelector('dl.su-stat-column')
    expect(column?.getAttribute('aria-label')).toBe('Gopher stats')
    const terms = [...(column?.querySelectorAll('dt') ?? [])].map((el) => el.textContent)
    const values = [...(column?.querySelectorAll('dd') ?? [])].map((el) => el.textContent)
    const expected = buildBookStats(gopher(), { techLevel: getTechLevel(gopher()) })
    expect(terms).toEqual(expected.map((s) => s.label))
    expect(values).toEqual(expected.map((s) => s.value))
  })

  test('the chassis ability is a framed card stamped "Chassis Ability" atop the right column', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const lead = container.querySelector('.su-entity-page__lead')
    expect(lead).not.toBeNull()
    expect(lead?.textContent).toContain('Chassis Ability')
  })

  test('page prose carries no leaf size class, so it reads at the page’s 18px', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const prose = container.querySelector('.su-entity-page__prose')
    expect(prose).not.toBeNull()
    expect(prose?.querySelector('.text-sm, .text-xs')).toBeNull()
    expect(prose?.querySelector('[data-prose="flavor"], .font-medium')).not.toBeNull()
  })

  test('the chassis ability reads at 14px, not the compact 12px', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const lead = container.querySelector('.su-entity-page__lead')
    expect(lead?.querySelector('.text-sm')).not.toBeNull()
    expect(lead?.querySelector('.text-xs')).toBeNull()
  })

  test('patterns are full-width link rows, with a phone’s "Show all" link', () => {
    const chassis = gopher()
    const count = chassis.patterns?.length ?? 0
    render(
      <PatternHrefProvider value={patternHref}>
        <ReferenceEntityCard data={chassis} presentation="page" />
      </PatternHrefProvider>
    )
    const rows = screen.getAllByRole('link', { name: /Gopher pattern$/ })
    expect(rows).toHaveLength(count)
    expect(screen.getByRole('link', { name: `Show all ${count} patterns` })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Patterns', level: 2 })).toBeTruthy()
  })

  test('an entity with no art reads as one column', () => {
    const { container } = render(<ReferenceEntityCard data={juryRig()} presentation="page" />)
    expect(container.querySelector('.su-entity-page')).not.toBeNull()
    expect(container.querySelector('.su-entity-page__main--art')).toBeNull()
    expect(container.querySelector('.su-entity-page__art')).toBeNull()
  })

  test('a nested card never takes the page presentation', () => {
    const { container } = render(
      <ReferenceEntityCard data={gopher()} presentation="page" depth={1} />
    )
    expect(container.querySelector('.su-entity-page')).toBeNull()
  })
})
