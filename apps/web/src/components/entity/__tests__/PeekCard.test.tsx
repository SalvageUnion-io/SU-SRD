/**
 * A PEEK's footer wears the header band (owner, 2026-10-14): the same fill as
 * the card's head, with the foreground measured against it. Off a Peek the
 * footer stays ink on the card's paper. Neither names the kind (E9).
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../../referenceEntity/card/ReferenceEntityCard'
import { PeekCard } from '../PeekCard'

const frost = () => {
  const system = SalvageUnionReference.Systems.getByName('Frost Protection')
  if (!system) throw new Error('fixture missing: Frost Protection')
  return system
}

const scrap = () => {
  const ability = SalvageUnionReference.Abilities.getByName('Scrap')
  if (!ability) throw new Error('fixture missing: Scrap')
  return ability
}

/** The footer's own block: the citation's cluster's row's parent. */
const footerOf = () => {
  const footer = screen.getByText(/· p\.\d+/).parentElement?.parentElement?.parentElement
  if (!footer) throw new Error('footer not found')
  return footer
}

describe('Peek footer', () => {
  test('paints the header band behind it', () => {
    render(<PeekCard entity={frost()} />)
    const footer = footerOf()
    expect(footer.style.background).not.toBe('')
    expect(footer.style.color).toMatch(/var\(--color-(ink|paper)\)/)
  })

  test('names no kind: only a Page foot stamps it (E9); the cite stays text', () => {
    render(<PeekCard entity={frost()} />)
    expect(footerOf().textContent).not.toContain('System')
    expect(footerOf().textContent).toMatch(/· p\.\d+/)
  })

  test('a card off a Peek keeps its footer on paper', () => {
    render(<ReferenceEntityCard data={frost()} size="mini" extent="full" />)
    expect(footerOf().style.background).toBe('')
  })

  // The Peek wears the fill of the Token or Row that opened it (owner,
  // 2026-10-14): an ability's tier tone, not the card's ink banner.
  test("an ability's Peek wears its tier tone, as its Token does", () => {
    const { container } = render(<PeekCard entity={scrap()} />)
    expect(container.querySelector('[style*="--color-pilot"]')).not.toBeNull()
  })

  // The dulled band is a nested color-mix() the test DOM drops, so this sees
  // only that the plain tone is gone; paint.test.ts and cardSeams.test.ts pin
  // the exact mix.
  test("a damaged trigger's Peek no longer wears the plain tone", () => {
    const { container } = render(<PeekCard entity={scrap()} down />)
    expect(container.querySelector('[style*="--color-pilot"]')).toBeNull()
  })
})

describe('Peek of a chassis ability', () => {
  const action = (name: string) => {
    const found = SalvageUnionReference.getByNameIn('actions', name)
    if (!found) throw new Error(`fixture missing: ${name}`)
    // A Peek opens any ref, an action's included (`PeekHost`).
    return found as unknown as RefEntity
  }

  test('names its one chassis where the book says [(CHASSIS)]', () => {
    const { container } = render(<PeekCard entity={action('Integrated Cargo Bay')} />)
    expect(container.textContent).not.toContain('[(CHASSIS)]')
    expect(container.textContent).toContain('The Mule')
  })

  test('an ability several chassis share reads "The Mech"', () => {
    const { container } = render(<PeekCard entity={action('Fast')} />)
    expect(container.textContent).not.toContain('[(CHASSIS)]')
    expect(container.textContent).toContain('The Mech')
  })
})

// Owner's call, 2026-10-14: peeking a chassis shows its chassis ability, not
// its patterns.
describe('Peek of a chassis', () => {
  const mule = () => {
    const chassis = SalvageUnionReference.Chassis.getByName('Mule')
    if (!chassis) throw new Error('fixture missing: Mule')
    return chassis
  }

  // N3, E19: the ability nests in the chassis, so it is a contentful Token,
  // never a Row or a card; inside the Peek its head opens nothing (E16).
  test('shows its chassis ability as a contentful Token', () => {
    const { container } = render(<PeekCard entity={mule()} />)
    const token = container.querySelector('.su-entity-token[data-contentful]')
    expect(token?.querySelector('.su-entity-token__head')?.textContent).toContain(
      'Integrated Cargo Bay'
    )
    const body = token?.querySelector('.su-entity-token__body')?.textContent ?? ''
    expect(body).toContain('The Mule')
    expect(body).not.toContain('[(CHASSIS)]')
    expect(container.querySelector('.su-entity-row')).toBeNull()
    expect(token?.querySelector('a')).toBeNull()
  })

  test('lists none of its patterns', () => {
    const { container } = render(<PeekCard entity={mule()} />)
    for (const pattern of mule().patterns ?? []) {
      expect(container.textContent).not.toContain(pattern.name)
    }
  })
})

// N1: the Peek is level 1 on its plate, so nothing in it is headed but itself:
// one head band, one frame, everything nested a Token.
describe('a Peek holds only Tokens', () => {
  const headedFrames = (container: HTMLElement) => ({
    heads: container.querySelectorAll('.su-entity-row__head, .su-entity-tile__band').length,
    frames: container.querySelectorAll('.su-ec-frame, .su-entity-row__frame').length,
  })

  test("a Bio-Titan's Peek lists none of its patterns; its actions are contentful Tokens", () => {
    const typhon = SalvageUnionReference.BioTitans.getByName('Typhon')
    if (!typhon) throw new Error('fixture missing: Typhon')
    const { container } = render(<PeekCard entity={typhon} />)
    expect(headedFrames(container)).toEqual({ heads: 1, frames: 1 })
    for (const pattern of typhon.patterns ?? []) {
      expect(container.textContent).not.toContain(pattern.name)
    }
    expect(container.querySelector('.su-entity-token[data-contentful]')).not.toBeNull()
  })

  test("a chassis's Peek: its frame, its head, and Tokens", () => {
    const chassis = SalvageUnionReference.Chassis.getByName('Big Brother')
    if (!chassis) throw new Error('fixture missing: Big Brother')
    const { container } = render(<PeekCard entity={chassis} />)
    expect(headedFrames(container)).toEqual({ heads: 1, frames: 1 })
  })

  test("an equipment item's Peek: its actions are Tokens, never framed cards", () => {
    const welder = SalvageUnionReference.Equipment.getByName('Portable Arc Welder')
    if (!welder) throw new Error('fixture missing: Portable Arc Welder')
    const { container } = render(<PeekCard entity={welder} />)
    expect(headedFrames(container)).toEqual({ heads: 1, frames: 1 })
    expect(container.querySelectorAll('.su-entity-token[data-contentful]').length).toBe(3)
  })

  // An option that is not an entity is a Slab over its text (N5), not a
  // framed option card with a head band.
  test("a choice's options are Slabs over their text, never framed and headed", () => {
    const rifle = SalvageUnionReference.Equipment.getByName('Custom Sniper Rifle')
    if (!rifle) throw new Error('fixture missing: Custom Sniper Rifle')
    const { container } = render(<PeekCard entity={rifle} />)
    expect(headedFrames(container)).toEqual({ heads: 1, frames: 1 })
    expect(container.querySelector('button[aria-pressed]')).toBeNull()
    expect(container.textContent).toContain('Rangefinder')
  })

  // A Peek is terminal (E16): a catalog choice is its Slab alone, no button.
  test("a catalog choice in a Peek is its Slab, with no 'Show options'", () => {
    const bay = SalvageUnionReference.CrawlerBays.getByName('Armament Bay')
    if (!bay) throw new Error('fixture missing: Armament Bay')
    const { container } = render(<PeekCard entity={bay} />)
    expect(container.textContent).toContain('Armament Bay Weapons System')
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).not.toContain('Show options')
  })
})

describe('a Peek prints every stat (owner, 2026-10-19)', () => {
  test("a chassis's Peek carries Heat Capacity and Cargo Capacity, not only its chip set", () => {
    const spectrum = SalvageUnionReference.Chassis.getByName('Spectrum')
    if (!spectrum) throw new Error('fixture missing: Spectrum')
    const { container } = render(<PeekCard entity={spectrum as RefEntity} />)
    const text = container.textContent ?? ''
    for (const short of ['TL', 'SV', 'SP', 'EP', 'SYS', 'MODS']) expect(text).toContain(short)
    expect(text).toMatch(/Heat/)
    expect(text).toMatch(/Cargo/)
  })
})
