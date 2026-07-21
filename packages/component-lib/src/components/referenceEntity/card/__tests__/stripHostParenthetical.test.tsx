/**
 * A nested action's ` (Host)` disambiguation suffix — display-only dedupe.
 *
 * Dataset action names are unique BY parenthetical (several systems each own a
 * "Refine"), so the data keeps "Refine (Nanite Sifter)". The card drops the
 * suffix only when the action renders inside that host's own card — anywhere
 * else the full name must survive, or the ambiguity the convention prevents
 * comes back.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'
import { stripHostParenthetical } from '../stripHostParenthetical'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(cleanup)

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
