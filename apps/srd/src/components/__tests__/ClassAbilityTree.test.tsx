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

  test('a Hybrid Class: its own trees and its branch trees are h2s', () => {
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
    // Core brick, Advanced orange, Hybrid rust, Legendary pink (its deeper band).
    expect(new Set(bandsOf('Forging'))).toEqual(new Set(['var(--color-tier-core)']))
    expect(new Set(bandsOf('Advanced Engineer'))).toEqual(new Set(['var(--color-pilot)']))
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

  test('a Legendary tree (pick one) has no track, so no numerals', () => {
    render(<ClassAbilityTree classEntity={classNamed('Engineer')} />)
    const legendary = screen
      .getAllByRole('heading', { level: 2, name: 'Legendary Engineer' })
      .map((h) => h.closest('section'))
      .find((section) => section?.querySelector('.srd-ability-tree__track'))
    if (!legendary) throw new Error('no Legendary tree')
    expect(legendary.querySelector('.srd-ability-tree__track')?.hasAttribute('data-track')).toBe(
      false
    )
    expect(legendary.querySelector('.srd-ability-tree__numeral')).toBeNull()
  })
})

describe('ClassAbilityTree training brief', () => {
  test("a Hybrid Class's brief says what it takes to advance, in the book's verb (p.23)", () => {
    render(<ClassAbilityTree classEntity={classNamed('Fabricator')} />)
    const labels = [...document.querySelectorAll('.srd-class-brief__row > dt')].map(
      (dt) => dt.textContent
    )
    expect(labels).toContain('Advance')
    expect(labels).not.toContain('Entry')
  })
})
