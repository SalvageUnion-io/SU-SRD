/**
 * A VEHICLE'S EQUIPMENT draws as cards, the drone way: every item it lists,
 * in the book's order and count, whether the data names a systems entry (the
 * Locomotion System) or the vehicle's own action (the Power Loader's Rigging
 * Arm, the Tombstone Trackbox's Shanty Home). Each keeps its own rules text,
 * and the vehicle has no ACTIONS slab. One rendering, so the SRD's page and
 * The Cantina's detail dialog draw it alike.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const vehicle = (name: string) => {
  const found = SalvageUnionReference.getByNameIn('vehicles', name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found as SURefEntity
}

/** The vehicle's Page, as text: its slab labels and every card's title and prose, in order. */
function pageOf(name: string) {
  const { container } = render(
    <ReferenceEntityCard data={vehicle(name)} presentation="page" disabled={false} />
  )
  return { text: container.textContent ?? '' }
}

describe('a vehicle page draws every item it lists as a card', () => {
  test('the Power Loader: Locomotion System, then Rigging Arm x 2, with no ACTIONS slab', () => {
    const { text } = pageOf('Power Loader')
    expect(text).not.toContain('Actions')
    // Each title found after the one before it: the book's order and count.
    let from = 0
    for (const title of ['Locomotion System', 'Rigging Arm', 'Rigging Arm']) {
      const at = text.indexOf(title, from)
      expect([title, at >= 0]).toEqual([title, true])
      from = at + title.length
    }
    // The vehicle's own Rigging Arm keeps its rules text: damage, melee, Load.
    expect(text).toContain('swung as an improvised melee weapon for 1 SP')
  })

  test('the Tombstone Trackbox and the E-Boat keep their own items’ prose, no ACTIONS slab', () => {
    const trackbox = pageOf('Tombstone Trackbox').text
    expect(trackbox).toContain('Shanty Home')
    expect(trackbox).toContain('Can safely transport a family of people across the wastes.')
    expect(trackbox).not.toContain('Actions')
    const boat = pageOf('E-Boat').text
    expect(boat).toContain('Integrated Amphibious Locomotion System')
    expect(boat).not.toContain('Actions')
    // The item reuses the Kraken's chassis text; its placeholder names the vehicle.
    expect(boat).not.toContain('[(CHASSIS)]')
    expect(boat).toContain('E-Boat has an integral')
  })
})
