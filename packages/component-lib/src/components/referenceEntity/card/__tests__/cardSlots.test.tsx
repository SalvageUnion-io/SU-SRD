/**
 * The card's generic SLOTS render where the anatomy says, and only when given:
 * `subtitleExtra` under the head, `afterExtraContent` after the body, `expand`
 * before the footer. And a header-only card (no body, no nested groups) grows
 * no lead gap: the empty strip the uniformity audit found on NPC actions.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const drill = () => need(SalvageUnionReference.Systems.getByName('Salvaging Drill'), 'drill')
const sniper = () =>
  need(SalvageUnionReference.Actions.getByName('Sniper Rifle (Ace)'), 'sniper rifle (ace)')

describe('card slots', () => {
  test('each slot renders its content, in anatomy order', () => {
    const { container } = render(
      <ReferenceEntityCard
        data={drill()}
        subtitleExtra={<span>sub line</span>}
        afterExtraContent={<span>after body</span>}
        expand={<span>expanded</span>}
      />
    )
    const text = container.textContent ?? ''
    expect(screen.getByText('sub line')).toBeTruthy()
    expect(text.indexOf('sub line')).toBeLessThan(text.indexOf('after body'))
    expect(text.indexOf('after body')).toBeLessThan(text.indexOf('expanded'))
  })

  test('a header-only card grows no empty lead strip', () => {
    const { container } = render(<ReferenceEntityCard data={sniper()} />)
    const frame = container.querySelector('.su-ec-frame')
    expect(frame).toBeTruthy()
    expect(frame?.querySelector('div[aria-hidden="true"][style*="height"]')).toBeNull()
  })
})
