/**
 * A nested action's ` (Host)` disambiguation suffix — display-only dedupe.
 *
 * Dataset action names are unique BY parenthetical (several systems each own a
 * "Refine"), so the data keeps "Refine (Nanite Sifter)". The card drops the
 * suffix only when the action renders inside that host's own card — anywhere
 * else the full name must survive, or the ambiguity the convention prevents
 * comes back.
 */
import { describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'
import { stripHostParenthetical } from '../stripHostParenthetical'

describe('stripHostParenthetical', () => {
  test('strips when the parenthetical matches the host exactly', () => {
    expect(stripHostParenthetical('Refine (Nanite Sifter)', 'Nanite Sifter')).toBe('Refine')
  })

  test('matches case-insensitively and trims', () => {
    expect(stripHostParenthetical('Refine (NANITE SIFTER)', 'nanite sifter')).toBe('Refine')
    expect(stripHostParenthetical('Refine ( Nanite Sifter )', 'Nanite Sifter')).toBe('Refine')
  })

  test('does NOT strip when the parenthetical names a different entity', () => {
    // The disambiguation must survive wherever the host is not the context —
    // never regex away an arbitrary trailing parenthetical.
    expect(stripHostParenthetical('Beta Fission Gun (Elite Beam Squad)', 'Nanite Sifter')).toBe(
      'Beta Fission Gun (Elite Beam Squad)'
    )
  })

  test('does NOT strip without host context', () => {
    expect(stripHostParenthetical('Refine (Nanite Sifter)', undefined)).toBe(
      'Refine (Nanite Sifter)'
    )
  })

  test('leaves names without a trailing parenthetical alone', () => {
    expect(stripHostParenthetical('Refine', 'Nanite Sifter')).toBe('Refine')
    // A mid-name parenthetical is not a suffix.
    expect(stripHostParenthetical('Refine (Nanite Sifter) Mk II', 'Nanite Sifter')).toBe(
      'Refine (Nanite Sifter) Mk II'
    )
  })

  test('a name that IS only a parenthetical is untouched', () => {
    expect(stripHostParenthetical('(Nanite Sifter)', 'Nanite Sifter')).toBe('(Nanite Sifter)')
  })
})

describe('nested action rendering', () => {
  const naniteSifter = () => {
    const found = SalvageUnionReference.Systems.all().find((s) => s.name === 'Nanite Sifter')
    if (!found) throw new Error('Nanite Sifter not in fixtures')
    return found
  }

  test('inside its host card the action title drops the redundant suffix', () => {
    render(<ReferenceEntityCard data={naniteSifter()} />)

    // The sibling action "Refine (Nanite Sifter)" renders as a nested card
    // whose title reads just "Refine" — the host card already names the parent.
    expect(screen.getByText('Refine')).toBeTruthy()
    expect(screen.queryByText('Refine (Nanite Sifter)')).toBeNull()
  })

  test('outside any host context the full disambiguated name renders', () => {
    const refine = SalvageUnionReference.Actions.all().find(
      (a) => a.name === 'Refine (Nanite Sifter)'
    )
    if (!refine) throw new Error('Refine (Nanite Sifter) not in fixtures')

    render(<ReferenceEntityCard data={refine as never} />)

    expect(screen.getByText('Refine (Nanite Sifter)')).toBeTruthy()
  })
})

/**
 * The display rule for an action's trailing ` (Suffix)`:
 *  - KEEP-case (suffix == owning entity): no `displayName` in data → the full
 *    disambiguated name survives out of host, stripped only inside the owner.
 *  - STRIP-case (generic suffix like `(NPC)`): a `displayName` == base is kept
 *    in data → the generic suffix never renders, in or out of host.
 *  - OVERRIDE: a hand-authored `displayName` wins verbatim everywhere.
 */
describe('action parenthetical display rule', () => {
  const fabricationArm = () => {
    const found = SalvageUnionReference.Systems.all().find((s) => s.name === 'Fabrication Arm')
    if (!found) throw new Error('Fabrication Arm not in fixtures')
    return found
  }
  const action = (name: string) => {
    const found = SalvageUnionReference.Actions.all().find((a) => a.name === name)
    if (!found) throw new Error(`${name} not in fixtures`)
    return found
  }

  test('KEEP: standalone shows the full owner-disambiguated name', () => {
    // Its redundant `displayName` was removed, so the name falls through in full.
    render(<ReferenceEntityCard data={action('Chassis Repair (Fabrication Arm)') as never} />)

    expect(screen.getByText('Chassis Repair (Fabrication Arm)')).toBeTruthy()
  })

  test('KEEP: inside the owner card the suffix is stripped', () => {
    render(<ReferenceEntityCard data={fabricationArm()} />)

    expect(screen.getByText('Chassis Repair')).toBeTruthy()
    expect(screen.queryByText('Chassis Repair (Fabrication Arm)')).toBeNull()
  })

  test('STRIP: the generic suffix never renders, standalone or in host', () => {
    // Standalone — the retained `displayName` strips `(NPC)`.
    render(<ReferenceEntityCard data={action('First Aid Kit (NPC)') as never} />)
    expect(screen.getByText('First Aid Kit')).toBeTruthy()
    expect(screen.queryByText('First Aid Kit (NPC)')).toBeNull()
    cleanup()

    // Inside its owner (Machine Gun Squad) — same, still no `(NPC)`.
    const owner = SalvageUnionReference.Squads.all().find((s) => s.name === 'Machine Gun Squad')
    if (!owner) throw new Error('Machine Gun Squad not in fixtures')
    render(<ReferenceEntityCard data={owner} />)
    expect(screen.getByText('First Aid Kit')).toBeTruthy()
    expect(screen.queryByText('First Aid Kit (NPC)')).toBeNull()
  })

  test('OVERRIDE: the hand-authored displayName wins verbatim', () => {
    render(<ReferenceEntityCard data={action('Electro-Whip (Android Osborne)') as never} />)

    expect(screen.getByText('Electro-Whip (Melee Armament)')).toBeTruthy()
    expect(screen.queryByText('Electro-Whip (Android Osborne)')).toBeNull()
  })
})
