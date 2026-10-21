/**
 * The card's stat/trait VOCABULARY, checked against how the rulebook prints it.
 *
 * - A qualified trait is a Tag with its parameter cell (E17): the book's
 *   "Burn (2) // Explosive (2) // Heavy // Uses (3)" becomes `[Burn | 2]`
 *   `[Explosive | 2]` `[Heavy]` `[Uses | 3]`, in the same order. A
 *   non-numeric amount (Uses/Destroy) is a parameter cell like any other.
 * - Every card labels stats with their SHORT forms (TL / SP / EP / SV / SYS /
 *   MODS): one anatomy at every size.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const action = (name: string) => {
  const found = SalvageUnionReference.Actions.getByName(name)
  if (!found) throw new Error(`${name} action fixture missing`)
  return found
}

const mule = () => {
  const found = SalvageUnionReference.Chassis.getByName('Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

/** Rendered text, whitespace-collapsed, for substring assertions. */
const textOf = (node: Parameters<typeof render>[0]) =>
  (render(node).container.textContent ?? '').replace(/\s+/g, ' ')

/** Each trait Tag's text: its name, then its parameter cell (`[Uses | 3]` reads "Uses3"). */
const tagsOf = (node: Parameters<typeof render>[0]) =>
  [...render(node).container.querySelectorAll<HTMLElement>('[data-tag]')].map(
    (el) => el.textContent
  )

describe('trait rendering (E17: Tags with a parameter cell)', () => {
  test('a NUMERIC uses amount is its parameter cell', () => {
    expect(tagsOf(<ReferenceEntityCard data={action('Beta Fission Gun')} />)).toContain('Uses3')
  })

  test('a NON-NUMERIC uses amount is a parameter cell too', () => {
    expect(tagsOf(<ReferenceEntityCard data={action('Armour Plating')} />)).toContain('UsesDestroy')
  })

  test('the traits are Tags, alphabetical with Uses last, with no "//" line', () => {
    const node = <ReferenceEntityCard data={action('Beta Fission Gun')} />
    expect(tagsOf(node)).toEqual(['Burn2', 'Energy', 'Explosive2', 'Heavy', 'Uses3'])
    expect(textOf(node)).not.toContain('//')
  })
})

describe('stat label short forms', () => {
  test('a compact card uses the abbreviations, within its budget (C3)', () => {
    const text = textOf(<ReferenceEntityCard data={mule()} size="compact" />)
    for (const label of ['TL', 'SP']) expect(text).toContain(label)
    // A chassis's other measures are the full card's, the Page's and the Peek's.
    for (const label of ['EP', 'SV', 'SYS', 'MODS']) expect(text).not.toContain(label)
  })

  test('a compact card never falls back to the half-form labels', () => {
    // Its patterns' descriptions are prose ("a legal Tech 1 build"), not labels.
    const text = textOf(
      <ReferenceEntityCard data={mule()} size="compact" hide={{ patterns: true }} />
    )
    // "Tech" with no "Level" beside it, and bare "System"/"Module", were the
    // three labels that read as neither the long nor the short form.
    expect(text).not.toContain('Tech')
    expect(text).not.toContain('System 16')
    expect(text).not.toContain('Module 2')
  })

  test('a full card wears the same value cells — one anatomy at every size', () => {
    // The large card's header carries the `[label | value]` cells
    // the compact one does; the two-line value boxes are retired.
    const text = textOf(<ReferenceEntityCard data={mule()} size="full" />)
    for (const label of ['TL', 'SP', 'EP', 'SV', 'SYS', 'MODS']) {
      expect(text).toContain(label)
    }
    expect(text).not.toContain('Tech Level')
  })
})
