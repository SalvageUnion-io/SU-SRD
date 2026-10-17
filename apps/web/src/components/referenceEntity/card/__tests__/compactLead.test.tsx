/**
 * The Row's LEAD (`<Entity form="row" lead>`): a listing asks for the entity's
 * own opening prose, clamped under the cells.
 *
 * Rendered with real SRD data:
 * - a chassis leads with its lore paragraph, an ability with its description;
 * - a system leads with its own paragraph when it has one, and one whose
 *   meaning lives in its actions with its action's opening paragraph — a
 *   listing shows prose whenever the entity carries any;
 * - the compact card (a slot, a deck) prints no prose.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Entity } from '../../../entity/Entity'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const gopher = () => need(SalvageUnionReference.Chassis.getByName('Gopher'), 'gopher')
const talkShop = () => need(SalvageUnionReference.Abilities.getByName('Talk Shop'), 'talk shop')
const drill = () => need(SalvageUnionReference.Systems.getByName('Salvaging Drill'), 'drill')
const cal50 = () =>
  need(SalvageUnionReference.Systems.getByName('.50 Cal Machine Gun'), '.50 cal machine gun')

// The lead is the compact card's one paragraph.
const lead = (container: HTMLElement) => container.querySelector('p')

describe('the row lead', () => {
  test('a chassis leads with its lore paragraph, its full text a tooltip', () => {
    const { container } = render(<Entity form="row" entity={gopher()} lead />)
    const paragraph = lead(container)
    expect(paragraph?.textContent).toStartWith("The 'TC40' Gopher was originally designed")
    // happy-dom drops `-webkit-line-clamp`, so the clamp itself is checked in
    // the browser; the full text stays reachable from the clamped line.
    expect(paragraph?.getAttribute('title')).toBe(paragraph?.textContent ?? '')
  })

  test('an ability leads with its description', () => {
    const { container } = render(<Entity form="row" entity={talkShop()} lead />)
    expect(lead(container)?.textContent).toBe(
      'Build rapport, and ask favours of other mechanics, salvagers, and workers.'
    )
  })

  test('a system leads with its own prose when it has some', () => {
    const { container } = render(<Entity form="row" entity={drill()} lead />)
    expect(lead(container)?.textContent).toStartWith('An Opus-designed industrial sized drill')
  })

  test('a system whose meaning lives in its actions leads with its action', () => {
    const { container } = render(<Entity form="row" entity={cal50()} lead />)
    expect(lead(container)?.textContent).toStartWith('This simple ballistic weapon')
  })

  test('trait markup in a lead reads as plain words, never raw brackets', () => {
    const overpower = need(SalvageUnionReference.Abilities.getByName('Overpower'), 'overpower')
    const { container } = render(<Entity form="row" entity={overpower} lead />)
    const text = lead(container)?.textContent ?? ''
    expect(text).toContain('Vulnerable')
    expect(text).not.toContain('[[')
  })

  test('the compact card prints no prose', () => {
    const { container } = render(
      <ReferenceEntityCard data={gopher()} size="compact" extent="head" />
    )
    expect(lead(container)).toBeNull()
  })
})

describe("an ability's row wears its tier; its card keeps the ink banner", () => {
  const fill = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-fill]')?.dataset.fill

  test('the compact card is a tier-toned Row; the full card takes the ink banner', () => {
    const row = render(<ReferenceEntityCard data={talkShop()} size="compact" extent="head" />)
    expect(fill(row.container)).toBe('tone')
    row.unmount()
    const full = render(<ReferenceEntityCard data={talkShop()} size="compact" />)
    expect(fill(full.container)).toBe('ink')
  })
})
