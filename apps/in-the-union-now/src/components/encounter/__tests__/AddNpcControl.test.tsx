/**
 * AddNpcControl — reference NPC search/browse + add tests (design-review R-5).
 *
 * Patches the reference model `.all`s (same seam as SalvageControl.test) so
 * candidate pools are deterministic, and asserts the add callback receives
 * the flattened candidate — including HP-vs-SP track derivation.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AddNpcControl } from '../AddNpcControl'
import { statTrackFor } from '../referenceNpcs'
import type { EncounterCandidate } from '../referenceNpcs'
import { must } from '../../__tests__/must'

afterEach(() => {
  cleanup()
})

const MOCK_NPCS = [
  { id: 'npc-1', name: 'Raider', hitPoints: 3, schemaName: 'npcs' },
  { id: 'npc-2', name: 'Trooper', hitPoints: 5, schemaName: 'npcs' },
]
const MOCK_BIO_TITANS = [
  { id: 'bt-1', name: 'Scylla', structurePoints: 39, schemaName: 'bio-titans' },
]

async function patchReference(empty = false): Promise<() => void> {
  const { SalvageUnionReference } = await import('salvageunion-reference')
  const models = [
    SalvageUnionReference.NPCs,
    SalvageUnionReference.Squads,
    SalvageUnionReference.Creatures,
    SalvageUnionReference.BioTitans,
    SalvageUnionReference.Vehicles,
    SalvageUnionReference.Meld,
  ]
  const originals = models.map((m) => m.all.bind(m))
  SalvageUnionReference.NPCs.all = mock(
    () => (empty ? [] : MOCK_NPCS) as unknown as ReturnType<typeof SalvageUnionReference.NPCs.all>
  )
  SalvageUnionReference.BioTitans.all = mock(
    () =>
      (empty ? [] : MOCK_BIO_TITANS) as unknown as ReturnType<
        typeof SalvageUnionReference.BioTitans.all
      >
  )
  SalvageUnionReference.Squads.all = mock(() => [])
  SalvageUnionReference.Creatures.all = mock(() => [])
  SalvageUnionReference.Vehicles.all = mock(() => [])
  SalvageUnionReference.Meld.all = mock(() => [])
  return () => {
    models.forEach((m, i) => {
      m.all = must(originals[i])
    })
  }
}

describe('AddNpcControl', () => {
  test('lists candidates and reports the picked one to onAdd', async () => {
    const restore = await patchReference()
    try {
      const added: EncounterCandidate[] = []
      render(
        <AddNpcControl
          onAdd={(c) => {
            added.push(c)
          }}
        />
      )

      fireEvent.click(screen.getByLabelText('Add Raider to the tray'))

      expect(added.length).toBe(1)
      expect(must(added[0]).name).toBe('Raider')
      expect(must(added[0]).schema).toBe('npcs')
      expect(must(added[0]).slug).toBe('raider')
      expect(must(added[0]).maxHp).toBe(3)
      expect(must(added[0]).statKind).toBe('hp')
    } finally {
      restore()
    }
  })

  test('search narrows the candidate list', async () => {
    const restore = await patchReference()
    try {
      render(<AddNpcControl onAdd={() => {}} />)

      fireEvent.change(screen.getByLabelText('Search reference NPCs'), {
        target: { value: 'scylla' },
      })

      expect(screen.getByLabelText('Add Scylla to the tray')).toBeTruthy()
      expect(screen.queryByLabelText('Add Raider to the tray')).toBeNull()
    } finally {
      restore()
    }
  })

  test('bio-titans derive an SP track from structurePoints', async () => {
    const restore = await patchReference()
    try {
      const added: EncounterCandidate[] = []
      render(
        <AddNpcControl
          onAdd={(c) => {
            added.push(c)
          }}
        />
      )

      fireEvent.click(screen.getByLabelText('Add Scylla to the tray'))

      expect(must(added[0]).statKind).toBe('sp')
      expect(must(added[0]).maxHp).toBe(39)
    } finally {
      restore()
    }
  })

  test('renders the empty message when reference data is unavailable', async () => {
    const restore = await patchReference(true)
    try {
      render(<AddNpcControl onAdd={() => {}} />)
      expect(screen.getByText('No reference NPCs available.')).toBeTruthy()
    } finally {
      restore()
    }
  })
})

describe('statTrackFor', () => {
  test('explicit damageType SP wins over hitPoints', () => {
    expect(statTrackFor({ hitPoints: 10, damageType: 'SP' })).toEqual({
      maxHp: 10,
      statKind: 'sp',
    })
  })

  test('hitPoints reads as HP, structurePoints as SP, absent as 0 HP', () => {
    expect(statTrackFor({ hitPoints: 4 })).toEqual({ maxHp: 4, statKind: 'hp' })
    expect(statTrackFor({ structurePoints: 12 })).toEqual({ maxHp: 12, statKind: 'sp' })
    expect(statTrackFor({})).toEqual({ maxHp: 0, statKind: 'hp' })
  })
})
