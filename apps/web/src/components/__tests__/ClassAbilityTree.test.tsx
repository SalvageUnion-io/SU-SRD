/**
 * A class page's ability trees are part of the page's outline (WCAG 1.3.1,
 * 2.4.6): each tree's slab is an `h2` and each Ability's title an `h3`, so a
 * screen-reader user jumps tree to tree and Ability to Ability.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { RefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ClassAbilityTree } from '../ClassAbilityTree'

const classNamed = (name: string): RefClass => {
  const found = SalvageUnionReference.Classes.getByName(name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found
}

/** A brief card's head band: the colour its cut-out head is painted. */
const headBand = (card: Element) =>
  card.querySelector<HTMLElement>('.su-entity-row__head')?.style.backgroundColor

describe('ClassAbilityTree headings', () => {
  test('each tree is an h2 and each Ability under it an h3', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const trees = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(trees).toContain('Mech-Tech')
    expect(trees).toContain('Legendary Engineer')
    const abilities = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(abilities).toContain('Jury Rig')
    // Every Ability Row in a tree titles itself with a heading.
    const rows = document.querySelectorAll('.su-ability-track__tier')
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
  test('every ability banner wears its tier; a tracked tier sets its numeral in its band', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const heads = [
      ...document.querySelectorAll<HTMLElement>('.su-ability-track__tier .su-entity-row__head'),
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
    const tiers = [...forging.querySelectorAll('.su-ability-track__tier')]
    // The numeral leads the band, left of the name, as every ability Row sets it.
    expect(
      tiers.map(
        (tier) =>
          tier.querySelector('.su-entity-row__line > .su-entity-row__tier:first-child')?.textContent
      )
    ).toEqual(['1', '2', '3'])
  })

  test('a Legendary tree (pick one) runs on a track with an "or" between picks, no numerals', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const legendary = screen
      .getAllByRole('heading', { level: 2, name: 'Legendary Engineer' })
      .map((h) => h.closest('section'))
      .find((section) => section?.querySelector('.su-ability-track'))
    if (!legendary) throw new Error('no Legendary tree')
    expect(legendary.querySelector('.su-ability-track')?.getAttribute('data-track')).toBe(
      'legendary'
    )
    expect(legendary.querySelector('.su-entity-row__tier')).toBeNull()
    // The "or" is its own row on the track, between each pick and the next.
    const track = legendary.querySelector('.su-ability-track')
    expect([...(track?.children ?? [])].map((li) => li.className)).toEqual([
      'su-ability-track__tier',
      'su-ability-track__or',
      'su-ability-track__tier',
    ])
    expect(track?.querySelector('.su-ability-track__or')?.textContent).toBe('or')
  })

  test('every Row on a track Peeks its ability', () => {
    const { container } = render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const tiers = [...container.querySelectorAll('.su-ability-track > .su-ability-track__tier')]
    expect(tiers.length).toBeGreaterThan(0)
    for (const tier of tiers) {
      expect(tier.querySelector('[data-peek^="abilities:"]')).not.toBeNull()
    }
  })
})

describe('ClassAbilityTree advancement paths', () => {
  test('a path head carries its name on the cut-out, its requirement right of it; its text opens the body', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const paths = [...document.querySelectorAll('.su-class-path')]
    expect(paths.length).toBeGreaterThan(1)
    for (const path of paths) {
      // The shared cut-out head (`Head`): the name on the tab, the chips right of it.
      const head = path.querySelector('.su-entity-row__head[data-notch]')
      expect(head?.querySelector('.su-entity-row__notch')?.textContent).not.toBe('')
      // Every chip (requirement, kind) is a direct chip of the head's one group.
      expect(
        head?.querySelector('.su-entity-row__heading--cut > .su-chips > .su-class-path__req-chip')
      ).not.toBeNull()
      expect(head?.querySelector('.su-class-path__note')).toBeNull()
      expect(path.querySelector('.su-class-path__body')?.firstElementChild?.className).toBe(
        'su-class-path__note'
      )
    }
    expect(paths[0]?.querySelector('.su-class-path__note')?.textContent).toContain(
      'Stay an Engineer'
    )
  })

  test('the class’s own path says it is that class’s only, as a chip like its neighbours', () => {
    render(<ClassAbilityTree classEntity={classNamed('Hacker')} />)
    const own = document.querySelector('.su-class-path[data-kind="legendary"]')
    const group = own?.querySelector('.su-entity-row__heading--cut > .su-chips')
    const chips = [...(group?.children ?? [])]
    // One chip line: the requirement, "Hacker only", then the kind, as siblings.
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'REQHacking',
      'Hacker only',
      'Legendary',
    ])
  })

  test('a Hybrid Class’s requirement is one chip naming its trees, no owning class', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const hybrids = [...document.querySelectorAll('.su-class-path[data-kind="hybrid"]')]
    expect(hybrids.length).toBeGreaterThan(0)
    for (const hybrid of hybrids) {
      const chips = hybrid.querySelector('.su-entity-row__heading--cut > .su-chips')
      // The requirement chip, then the kind: no owning-class chip.
      expect(chips?.childElementCount).toBe(2)
      const req = chips?.querySelector(':scope > .su-class-path__req-chip')
      const labels = [...(req?.querySelectorAll('.su-stat-plate--label') ?? [])].map(
        (label) => label.textContent
      )
      expect(labels[0]).toBe('REQ')
      expect(labels.slice(1)).toEqual(labels.slice(1).map(() => 'or'))
      expect(labels.length).toBeGreaterThan(1)
      expect(req?.textContent).not.toMatch(/Hacker|Soldier|Scout|Engineer/)
    }
  })

  test('a Hybrid Class’s whole cut-out head opens its page; the own path’s links nowhere', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const own = document.querySelector('.su-class-path[data-kind="legendary"]')
    expect(own?.querySelector(':scope > a')).toBeNull()
    const hybrid = document.querySelector('.su-class-path[data-kind="hybrid"]')
    const link = hybrid?.querySelector('a.su-class-path__link')
    expect(link?.getAttribute('href')).toMatch(/^\/classes\//)
    expect(link?.firstElementChild?.classList.contains('su-entity-row__head')).toBe(true)
  })

  test('the Core trees run in one column; the class’s own path leads the Hybrid Classes', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const core = document.querySelector('.su-ability-tree__row--stack')
    expect(core?.querySelectorAll(':scope > .su-ability-tree__group').length).toBeGreaterThan(1)
    expect(core?.querySelector('.su-class-path')).toBeNull()
    const kinds = [...document.querySelectorAll('.su-class-paths > .su-class-path')].map((path) =>
      path.getAttribute('data-kind')
    )
    expect(kinds[0]).toBe('legendary')
    expect(kinds.slice(1).length).toBeGreaterThan(0)
    expect(new Set(kinds.slice(1))).toEqual(new Set(['hybrid']))
    expect(document.querySelectorAll('.su-class-paths')).toHaveLength(1)
  })
})

describe('ClassAbilityTree training brief', () => {
  test("a Hybrid Class's brief says what it takes to advance, in the book's verb (p.23)", () => {
    render(<ClassAbilityTree classEntity={classNamed('Fabricator')} />)
    const labels = [
      ...document.querySelectorAll('.su-class-brief__card .su-entity-row__notch'),
    ].map((tab) => tab.textContent)
    expect(labels).toEqual(['Advance', 'Hybrid', 'Legendary'])
    expect(labels).not.toContain('Entry')
    // Its trees, with the classes that own them, follow the cards.
    expect(document.querySelector('.su-class-brief__trees')?.textContent).toContain('Engineer')
  })

  test('a Core class gets a tier card per tier, each costed in the pointy box', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const brief = screen.getByRole('complementary', { name: 'Training' })
    const cards = [...brief.querySelectorAll<HTMLElement>('.su-class-brief__card')]
    // Each head wears its tier's book hue (§3.8), the trees' own.
    expect(cards.map((card) => headBand(card))).toEqual([
      'var(--color-pilot)',
      'var(--color-tier-hybrid)',
      'var(--color-crawler-band)',
    ])
    expect(cards.map((card) => card.querySelector('.su-entity-row__head')?.textContent)).toEqual([
      'Core1 TP',
      'Advanced2 TP',
      'Legendary3 TP',
    ])
    expect(brief.textContent).toContain('Up to 10')
    // The Workshop Manual's words (p.23), not a paraphrase.
    expect(cards[2]?.textContent).toContain('You may only have one Legendary Ability.')
  })

  test('a Core class that never advances (Salvager) gets one Core card, from any of its trees', () => {
    render(<ClassAbilityTree classEntity={classNamed('Salvager')} />)
    const brief = screen.getByRole('complementary', { name: 'Training' })
    const cards = [...brief.querySelectorAll<HTMLElement>('.su-class-brief__card')]
    expect(cards.map((card) => headBand(card))).toEqual(['var(--color-pilot)'])
    expect(cards[0]?.querySelector('.su-entity-row__head')?.textContent).toBe('Core1 TP')
    expect(cards[0]?.textContent).toContain(
      'You must have the preceding skill in a Core Ability Tree to train the next Ability.'
    )
  })
})
