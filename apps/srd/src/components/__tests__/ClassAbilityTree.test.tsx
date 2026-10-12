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
