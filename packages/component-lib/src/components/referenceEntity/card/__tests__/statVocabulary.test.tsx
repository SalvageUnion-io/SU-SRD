/**
 * The card's stat/trait VOCABULARY, checked against how the rulebook prints it.
 *
 * - A qualified trait is parenthesised: the book's own lines read
 *   "Burn (2) // Explosive (2) // Heavy // Uses (3)", and its glossary entry for
 *   the trait reads "Uses (X)" — so the parens belong to the trait, not to the
 *   value being a number. A non-numeric amount (Uses/Destroy) used to render
 *   "USES DESTROY", a shape the book never prints.
 * - A compact card labels stats with their SHORT forms (TL / SP / EP / SV /
 *   SYS / MODS); the full card keeps the two-line long form.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const action = (name: string) => {
  const found = SalvageUnionReference.Actions.all().find((a) => a.name === name)
  if (!found) throw new Error(`${name} action fixture missing`)
  return found
}

const mule = () => {
  const found = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

/** Rendered text, whitespace-collapsed, for substring assertions. */
const textOf = (node: Parameters<typeof render>[0]) =>
  (render(node).container.textContent ?? '').replace(/\s+/g, ' ')

describe('trait rendering', () => {
  test('a NUMERIC uses amount is parenthesised', () => {
    const text = textOf(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    expect(text).toContain('Uses (3)')
  })

  test('a NON-NUMERIC uses amount is parenthesised too', () => {
    const text = textOf(<ReferenceEntityCard data={action('Armour Plating')} />)
    expect(text).toContain('Uses (Destroy)')
    // The bare form is exactly what this guards against.
    expect(text).not.toContain('Uses Destroy')
  })

  test('the whole trait line matches the book', () => {
    const text = textOf(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    expect(text).toContain('Burn (2) // Explosive (2) // Heavy // Uses (3)')
  })

  test('a label-only trait takes no parens', () => {
    const text = textOf(<ReferenceEntityCard data={action('Beta Fission Gun')} />)
    expect(text).toContain('Heavy //')
    expect(text).not.toContain('Heavy (')
  })
})

describe('stat label short forms', () => {
  test('a compact card uses the abbreviations', () => {
    const text = textOf(<ReferenceEntityCard data={mule()} size="medium" />)
    for (const label of ['TL', 'SP', 'EP', 'SV', 'SYS', 'MODS']) {
      expect(text).toContain(label)
    }
  })

  test('a compact card never falls back to the half-form labels', () => {
    const text = textOf(<ReferenceEntityCard data={mule()} size="medium" />)
    // "Tech" with no "Level" beside it, and bare "System"/"Module", were the
    // three labels that read as neither the long nor the short form.
    expect(text).not.toContain('Tech')
    expect(text).not.toContain('System 16')
    expect(text).not.toContain('Module 2')
  })

  test('a full card keeps the two-line long form', () => {
    const text = textOf(<ReferenceEntityCard data={mule()} size="large" />)
    expect(text).toContain('Tech')
    expect(text).toContain('Level')
    expect(text).toContain('System')
    expect(text).toContain('Slots')
  })
})
