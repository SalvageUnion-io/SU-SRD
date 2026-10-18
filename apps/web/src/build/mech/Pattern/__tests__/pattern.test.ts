/**
 * Tests for MechPattern schema and the patternStore CRUD.
 *
 * Covers:
 * - Schema validation: valid input passes, missing required fields throw
 * - Schema strictness: unknown fields throw
 * - patternStore CRUD round-trip: create → get → list → delete
 * - Instantiate path: mechFromPattern builds a fresh mech (new id, exact name, empty hold, sourcePattern)
 *
 * The stores hold rows in memory; writes run signed in, with server commits
 * stubbed by the test preload. No mock.module() — no global leak risk.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { MechPatternSchema } from 'cantina-domain/schemas/pattern'
import { mechFromPattern } from '../../../../lib/patterns/patterns'
import type { MonotonicClock } from '../../../../stores/__tests__/monotonicClock'
import { installMonotonicClock } from '../../../../stores/__tests__/monotonicClock'
import { resetStores } from '../../../../stores/__tests__/resetStores'
import { withSignedInBackend } from '../../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../../stores/entityStore'
import { usePatternStore } from '../../../../stores/patternStore'
import { FIXTURE_NOW } from '../../../../components/__tests__/fixtures'
import { must } from '../../../../components/__tests__/must'

// Saving a pattern needs an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

// `createdAt` / `updatedAt` come from `new Date()` inside `records.ts`, and the
// store prepends each new record. A monotonic clock makes consecutive writes distinct and
// ordered by construction, so the ordering assertions below need no sleeping.
let clock: MonotonicClock

beforeAll(() => {
  clock = installMonotonicClock()
})

afterAll(() => {
  clock.restore()
})

// ---------------------------------------------------------------------------
// Store reset between tests
// ---------------------------------------------------------------------------

beforeEach(async () => {
  resetStores()
  await usePatternStore.getState().hydrate()
})

afterEach(() => {
  resetStores()
})

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

const validPatternBase = {
  schemaVersion: 1 as const,
  name: 'Scout Loadout',
  chassisRef: 'mule',
  systems: ['targeting-system'],
  modules: ['armor-plating'],
  cargoLots: [
    {
      id: 'lot-medkit',
      kind: 'unit' as const,
      name: 'medkit',
      cat: 'SEALED' as const,
      units: 1,
      code: 'MED',
    },
  ],
}

describe('MechPatternSchema — valid input', () => {
  test('parses a fully valid pattern', () => {
    const result = MechPatternSchema.safeParse({
      id: 'pattern-1',
      createdAt: FIXTURE_NOW,
      ...validPatternBase,
    })
    expect(result.success).toBe(true)
  })

  test('accepts empty arrays for systems, modules, cargoLots', () => {
    const result = MechPatternSchema.safeParse({
      id: 'pattern-2',
      createdAt: FIXTURE_NOW,
      schemaVersion: 1,
      name: 'Bare Chassis',
      chassisRef: 'iron-mongrel',
      systems: [],
      modules: [],
      cargoLots: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('MechPatternSchema — invalid input', () => {
  test('rejects missing name', () => {
    const withoutName: Record<string, unknown> = { ...validPatternBase }
    delete withoutName.name
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: FIXTURE_NOW,
      ...withoutName,
    })
    expect(result.success).toBe(false)
  })

  test('rejects empty name (min length 1)', () => {
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: FIXTURE_NOW,
      ...validPatternBase,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing chassisRef', () => {
    const withoutChassisRef: Record<string, unknown> = { ...validPatternBase }
    delete withoutChassisRef.chassisRef
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: FIXTURE_NOW,
      ...withoutChassisRef,
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing id', () => {
    const result = MechPatternSchema.safeParse({
      createdAt: FIXTURE_NOW,
      ...validPatternBase,
    })
    expect(result.success).toBe(false)
  })

  test('rejects unknown fields (.strict())', () => {
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: FIXTURE_NOW,
      ...validPatternBase,
      unknownField: 'should fail',
    })
    expect(result.success).toBe(false)
  })

  test('rejects wrong schemaVersion', () => {
    const result = MechPatternSchema.safeParse({
      id: 'p',
      createdAt: FIXTURE_NOW,
      ...validPatternBase,
      schemaVersion: 2,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// patternStore CRUD round-trip
// ---------------------------------------------------------------------------

describe('patternStore — create + get round-trip', () => {
  test('create returns a pattern with a generated id and createdAt', async () => {
    const created = await usePatternStore.getState().create(validPatternBase)

    expect(typeof created.id).toBe('string')
    expect(created.id.length).toBeGreaterThan(0)
    expect(created.name).toBe('Scout Loadout')
    expect(created.chassisRef).toBe('mule')
    expect(created.systems).toEqual(['targeting-system'])
    expect(created.schemaVersion).toBe(1)
    expect(typeof created.createdAt).toBe('string')
  })

  test('get retrieves the created pattern by id', async () => {
    const created = await usePatternStore.getState().create(validPatternBase)
    const fetched = usePatternStore.getState().get(created.id)

    expect(fetched).not.toBeNull()
    expect(must(fetched).id).toBe(created.id)
    expect(must(fetched).name).toBe(created.name)
    expect(must(fetched).createdAt).toBe(created.createdAt)
  })

  test('get returns null for a non-existent id', async () => {
    const result = usePatternStore.getState().get('does-not-exist')
    expect(result).toBeNull()
  })
})

describe('patternStore — list', () => {
  test('list returns all patterns, newest first', async () => {
    const p1 = await usePatternStore.getState().create({ ...validPatternBase, name: 'Alpha' })
    const p2 = await usePatternStore.getState().create({ ...validPatternBase, name: 'Beta' })

    const all = usePatternStore.getState().list()
    expect(all.length).toBe(2)
    expect(must(all[0]).id).toBe(p2.id) // newest first
    expect(must(all[1]).id).toBe(p1.id)
  })

  test('list returns empty array when no patterns exist', async () => {
    const all = usePatternStore.getState().list()
    expect(all).toEqual([])
  })
})

describe('patternStore — delete', () => {
  test('delete removes the pattern; subsequent get returns null', async () => {
    const created = await usePatternStore.getState().create(validPatternBase)
    await usePatternStore.getState().delete(created.id)
    const fetched = usePatternStore.getState().get(created.id)
    expect(fetched).toBeNull()
  })

  test('delete is a silent no-op for an unknown id', async () => {
    // Should not throw
    await usePatternStore.getState().delete('does-not-exist')
  })
})

describe('patternStore — Zod rejection', () => {
  test('create rejects a pattern with an empty name', async () => {
    await expect(
      usePatternStore.getState().create({ ...validPatternBase, name: '' })
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Instantiate path: pattern → fresh mech
// ---------------------------------------------------------------------------

describe('instantiate from pattern — fresh mech with pattern fields', () => {
  test('mech created from pattern has a new id and fresh timestamps', async () => {
    const pattern = await usePatternStore.getState().create({
      schemaVersion: 1,
      name: 'Heavy Hauler',
      chassisRef: 'mule',
      systems: ['sys-a', 'sys-b'],
      modules: ['mod-x'],
      cargoLots: [
        {
          id: 'lot-fuel',
          kind: 'unit' as const,
          name: 'fuel-cell',
          cat: 'SEALED' as const,
          units: 1,
          code: 'FUE',
        },
      ],
    })

    // Instantiate through the same builder InstantiateFromPattern uses
    const mech = await useEntityStore.getState().create('mech', mechFromPattern(pattern))

    // Fresh identity — not the same id as the pattern
    expect(mech.id).not.toBe(pattern.id)

    // Timestamps are fresh
    expect(new Date(mech.createdAt).getTime()).toBeGreaterThan(
      new Date(pattern.createdAt).getTime()
    )

    // Loadout is copied; the pattern's exact name is kept; the hold starts empty
    expect(mech.chassisRef).toBe(pattern.chassisRef)
    expect(mech.systems).toEqual(pattern.systems)
    expect(mech.modules).toEqual(pattern.modules)
    expect(mech.name).toBe('Heavy Hauler')
    expect(mech.cargoLots).toEqual([])
    expect(mech.sourcePattern).toBe(pattern.id)

    // Pattern itself is unmodified
    const refetched = usePatternStore.getState().get(pattern.id)
    expect(refetched).not.toBeNull()
    expect(must(refetched).id).toBe(pattern.id)
  })
})
