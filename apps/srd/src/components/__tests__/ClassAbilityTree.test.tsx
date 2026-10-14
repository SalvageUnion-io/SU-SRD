/**
 * A class page's ability trees are part of the page's outline (WCAG 1.3.1,
 * 2.4.6): each tree's slab is an `h2` and each Ability's title an `h3`, so a
 * screen-reader user jumps tree to tree and Ability to Ability.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ClassAbilityTree } from '../ClassAbilityTree'

const classNamed = (name: string): SURefClass => {
  const found = SalvageUnionReference.Classes.getByName(name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found
}

describe('ClassAbilityTree headings', () => {
  test('each tree is an h2 and each Ability under it an h3', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const trees = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(trees).toContain('Mech-Tech')
    expect(trees).toContain('Legendary Engineer')
    const abilities = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(abilities).toContain('Jury Rig')
    // Every Ability Row in a tree titles itself with a heading.
    const rows = document.querySelectorAll('.srd-ability-tree__tier')
    expect(abilities).toHaveLength(rows.length)
  })

  test('a Hybrid Class: its own trees and its required trees are h2s', () => {
    render(<ClassAbilityTree classEntity={classNamed('Fabricator')} />)
    const trees = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(trees).toContain('Fabricator')
    expect(trees).toContain('Legendary Fabricator')
    expect(trees).toContain('Forging')
  })
})

describe('ClassAbilityTree banners and track', () => {
  test('every ability banner wears its tier; a tracked tier sets its numeral on the track', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const heads = [
      ...document.querySelectorAll<HTMLElement>('.srd-ability-tree__tier .su-entity-row__head'),
    ]
    expect(heads.length).toBeGreaterThan(0)
    for (const head of heads) expect(head.dataset.fill).toBe('tone')
    const bandsOf = (tree: string) =>
      screen
        .getAllByRole('heading', { level: 2, name: tree })
        .flatMap((h) => [
          ...(h.closest('section')?.querySelectorAll<HTMLElement>('.su-entity-row__head') ?? []),
        ])
        .map((head) => head.style.backgroundColor)
    // Core orange, Advanced and Hybrid rust, Legendary pink (its deeper band).
    expect(new Set(bandsOf('Forging'))).toEqual(new Set(['var(--color-pilot)']))
    expect(new Set(bandsOf('Advanced Engineer'))).toEqual(new Set(['var(--color-tier-hybrid)']))
    expect(new Set(bandsOf('Fabricator'))).toEqual(new Set(['var(--color-tier-hybrid)']))
    expect(new Set(bandsOf('Legendary Engineer'))).toEqual(new Set(['var(--color-crawler-band)']))

    const forging = screen.getByRole('heading', { level: 2, name: 'Forging' }).closest('section')
    if (!forging) throw new Error('no Forging tree')
    const tiers = [...forging.querySelectorAll('.srd-ability-tree__tier')]
    expect(
      tiers.map((tier) => tier.querySelector('.srd-ability-tree__numeral')?.textContent)
    ).toEqual(['1', '2', '3'])
    // The numeral sits outside the banner: the band leads with the name.
    for (const tier of tiers) {
      const line = tier.querySelector('.su-entity-row__line')
      expect(line?.firstElementChild?.querySelector('h3')).not.toBeNull()
    }
  })

  test('a Legendary tree (pick one) runs on a track with an "or" between picks, no numerals', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const legendary = screen
      .getAllByRole('heading', { level: 2, name: 'Legendary Engineer' })
      .map((h) => h.closest('section'))
      .find((section) => section?.querySelector('.srd-ability-tree__track'))
    if (!legendary) throw new Error('no Legendary tree')
    expect(legendary.querySelector('.srd-ability-tree__track')?.getAttribute('data-track')).toBe(
      'legendary'
    )
    expect(legendary.querySelector('.srd-ability-tree__numeral')).toBeNull()
    // The "or" sits on the track below each pick but the last, centred on the run to the next.
    const tiers = [...legendary.querySelectorAll('.srd-ability-tree__tier')]
    expect(
      tiers.map((tier) => tier.querySelector(':scope > .srd-ability-tree__or')?.textContent)
    ).toEqual(tiers.map((_, index) => (index === tiers.length - 1 ? undefined : 'or')))
  })
})

describe('ClassAbilityTree advancement paths', () => {
  test('a path head carries its name on the cut-out, its requirement right of it; its text opens the body', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const paths = [...document.querySelectorAll('.srd-class-path')]
    expect(paths.length).toBeGreaterThan(1)
    for (const path of paths) {
      const head = path.querySelector('.srd-class-path__head')
      expect(head?.firstElementChild?.className).toBe('srd-class-path__name')
      expect(head?.querySelector('.srd-class-path__band .srd-class-path__req')).not.toBeNull()
      expect(head?.querySelector('.srd-class-path__note')).toBeNull()
      expect(path.querySelector('.srd-class-path__body')?.firstElementChild?.className).toBe(
        'srd-class-path__note'
      )
    }
    expect(paths[0]?.querySelector('.srd-class-path__note')?.textContent).toContain(
      'Stay an Engineer'
    )
  })

  test('a Hybrid Class’s requirement is one chip naming its trees, no owning class', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const hybrids = [...document.querySelectorAll('.srd-class-path[data-kind="hybrid"]')]
    expect(hybrids.length).toBeGreaterThan(0)
    for (const hybrid of hybrids) {
      const req = hybrid.querySelector('.srd-class-path__req')
      expect(req?.childElementCount).toBe(1)
      expect(req?.textContent).toMatch(/^REQ.+ or .+$/)
      expect(req?.textContent).not.toMatch(/Hacker|Soldier|Scout|Engineer/)
    }
  })

  test('the class’s own path sits beside its Core trees; each Hybrid Class runs below', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const split = document.querySelector('.srd-ability-tree__split')
    expect(split?.querySelectorAll('.srd-class-path')).toHaveLength(1)
    expect(split?.querySelector('.srd-class-path')?.getAttribute('data-kind')).toBe('legendary')
    const hybrids = [...document.querySelectorAll('.srd-class-path[data-kind="hybrid"]')]
    expect(hybrids.length).toBeGreaterThan(0)
    for (const hybrid of hybrids) expect(split?.contains(hybrid)).toBe(false)
  })
})

describe('ClassAbilityTree training brief', () => {
  test("a Hybrid Class's brief says what it takes to advance, in the book's verb (p.23)", () => {
    render(<ClassAbilityTree classEntity={classNamed('Fabricator')} />)
    const labels = [...document.querySelectorAll('.srd-class-brief__tab')].map(
      (tab) => tab.textContent
    )
    expect(labels).toEqual(['Advance', 'Hybrid', 'Legendary'])
    expect(labels).not.toContain('Entry')
    // Its trees, with the classes that own them, follow the cards.
    expect(document.querySelector('.srd-class-brief__trees')?.textContent).toContain('Engineer')
  })

  test('a Core class gets a tier card per tier, each costed in the pointy box', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const brief = screen.getByRole('complementary', { name: 'Training' })
    const cards = [...brief.querySelectorAll<HTMLElement>('.srd-class-brief__card')]
    expect(cards.map((card) => card.dataset.tier)).toEqual(['core', 'advanced', 'legendary'])
    expect(cards.map((card) => card.querySelector('.srd-class-brief__band')?.textContent)).toEqual([
      'Core1 TP',
      'Advanced2 TP',
      'Legendary3 TP',
    ])
    expect(brief.textContent).toContain('Up to 10')
  })

  test('a Core class that never advances (Salvager) gets one Core card, from any of its trees', () => {
    render(<ClassAbilityTree classEntity={classNamed('Salvager')} />)
    const brief = screen.getByRole('complementary', { name: 'Training' })
    const cards = [...brief.querySelectorAll<HTMLElement>('.srd-class-brief__card')]
    expect(cards.map((card) => card.dataset.tier)).toEqual(['core'])
    expect(cards[0]?.querySelector('.srd-class-brief__band')?.textContent).toBe('Core1 TP')
    expect(cards[0]?.textContent).toContain('Each, from any Core tree, in tree order.')
  })
})
