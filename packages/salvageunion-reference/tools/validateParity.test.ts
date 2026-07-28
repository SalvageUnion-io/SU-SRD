/**
 * Rules-parity audit (ADR-029 §5).
 *
 * Fixture-driven: the detector's BEHAVIOUR is asserted against synthetic
 * records, so these tests keep passing as real content is encoded. A test that
 * asserted "Beefcake is unencoded" would have to be rewritten the moment the
 * backlog was worked off — which is exactly when a regression test matters most.
 */

import { describe, expect, it } from 'bun:test'

import { auditParity, unresolvedFindings } from './validateParityLogic.js'

const ability = (over: Record<string, unknown>) => ({
  name: 'Test Ability',
  content: [{ type: 'paragraph', value: 'Nothing mechanical here.' }],
  ...over,
})

describe('parity audit — detection', () => {
  it('flags a stated cap change that carries no structured data', () => {
    const findings = auditParity({
      'abilities.json': [
        ability({ content: [{ value: "You increase your Pilot's Max HP by 2." }] }),
      ],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ klass: 'cap', encoded: false })
    expect(unresolvedFindings(findings)).toHaveLength(1)
  })

  it('accepts the same claim once the record carries contributions', () => {
    const findings = auditParity({
      'abilities.json': [
        ability({
          content: [{ value: "You increase your Pilot's Max HP by 2." }],
          contributions: [{ stat: 'maxHp', target: 'pilot', amount: 2 }],
        }),
      ],
    })
    expect(findings[0]?.encoded).toBe(true)
    expect(unresolvedFindings(findings)).toHaveLength(0)
  })

  it('accepts a statBonus for an installable item', () => {
    const findings = auditParity({
      'systems.json': [
        {
          name: 'Test Sink',
          content: [{ value: 'This increases the Maximum Heat Capacity of a Mech by 1.' }],
          statBonus: { heatCapacity: 1 },
        },
      ],
    })
    expect(unresolvedFindings(findings)).toHaveLength(0)
  })

  it('ignores prose that states no mechanical change', () => {
    expect(auditParity({ 'abilities.json': [ability({})] })).toHaveLength(0)
  })

  it('attributes a claim in actions.json to the record that must encode it', () => {
    const findings = auditParity({
      'systems.json': [{ name: 'Test Armour', actions: ['Test Armour'] }],
      'actions.json': [
        {
          name: 'Test Armour',
          content: [{ value: "This System increases your Mech's Max SP by 5." }],
        },
      ],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ record: 'Test Armour', schema: 'systems.json' })
  })

  it('does NOT audit adversary stat blocks — their effects are adjudicated, not derived', () => {
    const findings = auditParity({
      'npcs.json': [{ name: 'Nasty', content: [{ value: 'The target gains the Prone Trait.' }] }],
      'creatures.json': [
        { name: 'Beast', content: [{ value: 'Deals an additional 2 SP damage.' }] },
      ],
    })
    expect(findings).toHaveLength(0)
  })

  it('reports one finding per record per class, not one per sentence', () => {
    const findings = auditParity({
      'abilities.json': [
        ability({
          content: [
            { value: "You increase your Pilot's Max HP by 2." },
            { value: 'You also increase your Pilot’s Max AP by 1.' },
          ],
        }),
      ],
    })
    expect(findings).toHaveLength(1)
  })
})

describe('parity audit — exemptions', () => {
  it('treats an exempt record as resolved and carries its reason', () => {
    const findings = auditParity({
      'chassis.json': [
        {
          name: 'Integrated Cargo Bay',
          content: [{ value: 'Increases the Cargo Capacity of the Mule by 10, to 16.' }],
        },
      ],
    })
    expect(findings[0]?.exempt).toContain('chassis-integrated')
    expect(unresolvedFindings(findings)).toHaveLength(0)
  })
})
