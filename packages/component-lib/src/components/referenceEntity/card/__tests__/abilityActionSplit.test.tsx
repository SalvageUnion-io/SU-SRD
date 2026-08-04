/**
 * The Mech/Pilot action SPLIT on an ability card.
 *
 * A handful of abilities cost a different action depending on whether you
 * perform them boarded or on foot, and the book prints both halves on one line —
 * "Turn Action (Mech) // Short Action (Pilot)" (core book p.248-249). The card
 * previously rendered only the Pilot half, unqualified, so a reader had no way to
 * tell the mech timing existed: `mechActionType` was stored on all seven split
 * abilities and read by nothing.
 *
 * These tests pin BOTH halves to the card, and pin the far larger unsplit case
 * (every other action in the dataset) to its unchanged single unqualified cell.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const ability = (name: string) => {
  const found = SalvageUnionReference.Abilities.all().find((a) => a.name === name)
  if (!found) throw new Error(`${name} fixture missing`)
  return found
}

/** Rendered text, whitespace-collapsed, for substring assertions. */
const textOf = (node: Parameters<typeof render>[0]) =>
  (render(node).container.textContent ?? '').replace(/\s+/g, ' ')

describe('ability card action split', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  // Scrap is the sharpest case: the two halves are DIFFERENT action types, so a
  // card showing only one of them is visibly missing a rule.
  test('Scrap shows both halves, Mech first, as the book prints them', () => {
    const text = textOf(<ReferenceEntityCard data={ability('Scrap')} />)

    expect(text).toContain('Turn Action (Mech)')
    expect(text).toContain('Short Action (Pilot)')
    expect(text.indexOf('Turn Action (Mech)')).toBeLessThan(text.indexOf('Short Action (Pilot)'))
  })

  test('Load shows its Turn/Short split', () => {
    const text = textOf(<ReferenceEntityCard data={ability('Load')} />)

    expect(text).toContain('Turn Action (Mech)')
    expect(text).toContain('Short Action (Pilot)')
  })

  // Repair is the common shape among the seven — Short in a Mech, Long on foot.
  test('Repair shows its Short/Long split', () => {
    const text = textOf(<ReferenceEntityCard data={ability('Repair')} />)

    expect(text).toContain('Short Action (Mech)')
    expect(text).toContain('Long Action (Pilot)')
  })

  test('every ability carrying a mech variant renders both halves', () => {
    const split = SalvageUnionReference.Abilities.all().filter((a) => a.mechActionType)
    expect(split.length).toBeGreaterThan(0)

    for (const entity of split) {
      const text = textOf(<ReferenceEntityCard data={entity} />)
      expect(text).toContain('(Mech)')
      expect(text).toContain('(Pilot)')
    }
  })

  // The unsplit case is the overwhelming majority — it must not gain qualifiers.
  test('an ability with no mech variant stays a single unqualified type', () => {
    const plain = ability('Craft')
    expect(plain.mechActionType).toBeUndefined()

    const text = textOf(<ReferenceEntityCard data={plain} />)
    expect(text).not.toContain('(Mech)')
    expect(text).not.toContain('(Pilot)')
  })
})
