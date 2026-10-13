import { describe, expect, test } from 'bun:test'
import { getEntitySchemas } from '../gameData'
import { plainText } from '../rollTablePage'
import type { ScreenReference } from '../screenPage'
import { screenPanels } from '../screenPage'

/**
 * The Mediator Screen's panels: the Quick Reference Sheet's first page (Quick
 * Ref Sheets Digital 2.0 p.1), in its order, each citing its Workshop Manual
 * page and linking to its own page here.
 */
describe('screenPanels', () => {
  const panels = screenPanels()
  const reference = (title: string) =>
    panels.find((p): p is ScreenReference => p.kind === 'reference' && p.title === title)

  test('sets the Quick Ref tables in its order', () => {
    expect(panels.map((p) => `${p.section}: ${p.title}`)).toEqual([
      'Core resolution: Core Mechanic',
      'Action scene: Group Initiative',
      'Action scene: Distances',
      'Damage: Critical Injury',
      'Damage: Critical Damage',
      'Heat: Heat',
      'Heat: Reactor Overload',
      'Salvaging: Area Salvage',
      'Salvaging: Mech Salvage',
      'NPC tables: Reaction Roll',
      'NPC tables: NPC Action',
      'NPC tables: Morale',
      'NPC tables: Retreat',
      'Downtime: Downtime',
    ])
  })

  test('every d20 table carries all five bands, and every panel its page and link', () => {
    for (const panel of panels) {
      expect(panel.page).toBeGreaterThan(0)
      expect(panel.href).toMatch(/^\/[a-z-]+\/([a-z0-9-]+\/)?$/)
      if (panel.kind === 'table') expect(panel.data.rows.map((r) => r.key)).toHaveLength(5)
    }
    expect(panels.find((p) => p.title === 'Critical Injury')?.page).toBe(241)
  })

  test('the distances link to a listing the site builds', () => {
    expect(reference('Distances')?.href).toBe('/distances/')
    expect(getEntitySchemas().map((s) => s.id)).toContain('distances')
    expect(reference('Distances')?.notes.map((n) => n.term)).toEqual([
      'Close',
      'Medium',
      'Long',
      'Far',
    ])
  })

  test('Heat reads the Heat Check in the guide’s words', () => {
    const heat = reference('Heat')
    expect(heat?.notes.map((n) => n.term)).toEqual(['Heat Capacity', 'Heat Check', 'Venting Heat'])
    const check = heat?.notes.find((n) => n.term === 'Heat Check')
    expect(plainText(check?.text ?? [])).toContain('A roll of a 20 is always a success')
  })

  test('Downtime lists its steps under Post-Session and Pre-Session', () => {
    const steps = reference('Downtime')?.steps ?? []
    expect(steps.map((s) => s.heading)).toEqual(['Post-Session', 'Pre-Session'])
    expect(steps[0]?.names[0]).toBe('Tally Salvage')
    expect(steps[1]?.names).toContain('Gather Cantina Rumours')
  })
})
