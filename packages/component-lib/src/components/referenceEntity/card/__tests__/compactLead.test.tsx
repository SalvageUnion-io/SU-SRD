/**
 * The compact card's LEAD (`leadProse`): a listing asks for the entity's own
 * opening prose, clamped under the cells.
 *
 * Rendered through the real card with real SRD data:
 * - a chassis leads with its lore paragraph, an ability with its description;
 * - a system leads with its own paragraph when it has one, and one whose
 *   meaning lives in its actions with its action's opening paragraph — a
 *   listing shows prose whenever the entity carries any;
 * - without the prop (a slot, a deck) the compact card prints no prose.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
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

describe('the compact card lead', () => {
  test('a chassis leads with its lore paragraph, its full text a tooltip', () => {
    const { container } = render(
      <ReferenceEntityCard data={gopher()} size="medium" extent="head" leadProse />
    )
    const paragraph = lead(container)
    expect(paragraph?.textContent).toStartWith("The 'TC40' Gopher was originally designed")
    // happy-dom drops `-webkit-line-clamp`, so the clamp itself is checked in
    // the browser; the full text stays reachable from the clamped line.
    expect(paragraph?.getAttribute('title')).toBe(paragraph?.textContent ?? '')
  })

  test('an ability leads with its description', () => {
    const { container } = render(
      <ReferenceEntityCard data={talkShop()} size="medium" extent="head" leadProse />
    )
    expect(lead(container)?.textContent).toBe(
      'Build rapport, and ask favours of other mechanics, salvagers, and workers.'
    )
  })

  test('a system leads with its own prose when it has some', () => {
    const { container } = render(
      <ReferenceEntityCard data={drill()} size="medium" extent="head" leadProse />
    )
    expect(lead(container)?.textContent).toStartWith('An Opus-designed industrial sized drill')
  })

  test('a system whose meaning lives in its actions leads with its action', () => {
    const { container } = render(
      <ReferenceEntityCard data={cal50()} size="medium" extent="head" leadProse />
    )
    expect(lead(container)?.textContent).toStartWith('This simple ballistic weapon')
  })

  test('trait markup in a lead reads as plain words, never raw brackets', () => {
    const overpower = need(SalvageUnionReference.Abilities.getByName('Overpower'), 'overpower')
    const { container } = render(
      <ReferenceEntityCard data={overpower} size="medium" extent="head" leadProse />
    )
    const text = lead(container)?.textContent ?? ''
    expect(text).toContain('Vulnerable')
    expect(text).not.toContain('[[')
  })

  test('without leadProse the compact card prints no prose', () => {
    const { container } = render(
      <ReferenceEntityCard data={gopher()} size="medium" extent="head" />
    )
    expect(lead(container)).toBeNull()
  })
})

describe('an ability row keeps the ink banner', () => {
  const fill = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-fill]')?.dataset.fill

  test('the compact card and the full card both take the ink banner (ruleset §3.1)', () => {
    const row = render(<ReferenceEntityCard data={talkShop()} size="medium" extent="head" />)
    expect(fill(row.container)).toBe('ink')
    row.unmount()
    const full = render(<ReferenceEntityCard data={talkShop()} size="medium" />)
    expect(fill(full.container)).toBe('ink')
  })
})
