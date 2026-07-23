/**
 * A chassis PATTERN has no entity of its own — it is a nested object on the
 * chassis, so its card's `data` IS the chassis. These tests pin the two things
 * that makes true of the UI:
 *
 * 1. A pattern row in a chassis's Patterns list opens the full pattern view in a
 *    detail dialog (it can't navigate to an entity page it doesn't have).
 * 2. The full pattern view reads chassis prose → chassis ability → pattern prose
 *    → systems → modules, so the pattern is framed by the chassis it belongs to.
 */
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** The Mule — a chassis carrying patterns, a chassis ability and chassis prose. */
const mule = () => {
  const found = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

afterEach(cleanup)

describe('chassis pattern rows', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('every pattern row is an activatable control named for its pattern', () => {
    const chassis = mule()
    render(<ReferenceEntityCard data={chassis} />)

    const rows = screen.getAllByRole('button', { name: /— Mule pattern$/ })
    expect(rows.length).toBe(chassis.patterns?.length ?? 0)
    expect(rows.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Hauler — Mule pattern' })).toBeDefined()
  })

  test('clicking a pattern row opens the pattern in a dialog', () => {
    const chassis = mule()
    render(<ReferenceEntityCard data={chassis} />)

    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Hauler — Mule pattern' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    // The dialog holds the FULL pattern view: the pattern's own loadout, which
    // the collapsed row never shows.
    expect(dialog.textContent).toContain('Transport Hold')
    expect(dialog.textContent).toContain('Hauler')
  })
})

describe('full pattern view reading order', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('reads chassis prose → chassis ability → pattern prose → systems → modules', () => {
    const chassis = mule()
    const pattern = chassis.patterns?.find((p) => p.name === 'Hauler')
    if (!pattern) throw new Error('Hauler pattern fixture missing')

    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} size="large" />
    )
    const text = container.textContent ?? ''

    const chassisProse = text.indexOf("The 'M-63' Mule was developed")
    const chassisAbility = text.indexOf('Integrated Cargo Bay')
    const patternProse = text.indexOf('This Mule, favoured by wastelanders')
    const systems = text.indexOf('Transport Hold')
    const modules = text.indexOf('Reactor Flare')

    for (const index of [chassisProse, chassisAbility, patternProse, systems, modules]) {
      expect(index).toBeGreaterThan(-1)
    }
    expect(chassisProse).toBeLessThan(chassisAbility)
    expect(chassisAbility).toBeLessThan(patternProse)
    expect(patternProse).toBeLessThan(systems)
    expect(systems).toBeLessThan(modules)
  })
})
