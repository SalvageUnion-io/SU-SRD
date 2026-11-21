/** `ledgerOrderFaults` judges a Ledger's head stamps against the stat order (ledger.md L5, ruleset §2.6). */
import { describe, expect, test } from 'bun:test'
import { ledgerOrderFaults, ledgerRank } from '../lib/ledgerOrder'

describe('ledgerOrderFaults', () => {
  test('the stat order passes, whatever a list drops', () => {
    expect(
      ledgerOrderFaults(['TL', 'Slots', 'SV', 'SP', 'EP', 'Sys', 'Mods', 'Heat', 'Cargo'])
    ).toEqual([])
    expect(ledgerOrderFaults(['Slots', 'Action', 'RNG', 'DMG', 'Traits', 'Cost'])).toEqual([])
    expect(ledgerOrderFaults(['Lvl', 'Action', 'AP'])).toEqual([])
  })

  test('words that place the entity carry no rank', () => {
    expect(ledgerRank('Tree')).toBeUndefined()
    expect(ledgerOrderFaults(['Tree', 'Slots', 'Made by', 'RNG', 'Loadout'])).toEqual([])
  })

  test('a moved column fails, named with the stat it stands after', () => {
    expect(ledgerOrderFaults(['Slots', 'Cost', 'RNG', 'DMG'])).toEqual([
      'RNG after Cost',
      'DMG after Cost',
    ])
    expect(ledgerOrderFaults(['SP', 'EP', 'SV'])).toEqual(['SV after EP'])
  })
})
