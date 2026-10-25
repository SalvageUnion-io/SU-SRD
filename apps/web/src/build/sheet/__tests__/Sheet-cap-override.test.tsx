/**
 * Cap-override integration (P2.2 / ADR-022): a Live-Sheet stat gauge with a
 * hand-pinned maximum shows an "overridden from N" indicator + a one-click
 * revert, and reverting clears the pin with an `override` op (ADR-063).
 * Exercises the real in-memory store, signed in, with the Convex client a
 * recorder of the ops the store sends.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { installConvexMocks } from '../../../components/__tests__/convexMock'

const logged: { kind: string; field: string }[] = []

const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (
      ref: unknown,
      args: { op?: { kind: string; patch: object; unset?: string[] } }
    ) => {
      if (getFunctionName(ref as FunctionReference<'mutation'>) === 'ops:apply' && args.op) {
        const { kind, patch, unset = [] } = args.op
        for (const field of [...Object.keys(patch), ...unset]) logged.push({ kind, field })
      }
      return { updatedAt: 1, headSeq: 1 }
    },
  },
})

const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')
const { Sheet } = await import('../Sheet')

afterAll(() => {
  convexMocks.restore()
})

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Everything burns.',
  keepsake: 'A compass.',
  appearance: 'Tall.',
  background: '',
  conditions: [],
}

beforeEach(() => {
  logged.length = 0
  resetStores()
})

describe('Live Sheet — cap override (P2.2)', () => {
  test('a pinned HP max shows the indicator; revert clears it and logs an override', async () => {
    const store = useUnits.getState()
    // maxHpOverride is an ABSOLUTE pin (ADR-022 amendment) — base 10, pinned 14.
    const pilot = await store.create('pilot', { ...basePilotInput, maxHpOverride: 14 })

    render(<Sheet kind="pilot" id={pilot.id} />)

    // The override indicator renders on the HP gauge, naming the derived value.
    await waitFor(() => expect(screen.getByText(/overridden from 10/i)).toBeTruthy())

    // One-click revert to the derived baseline.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /revert hp max to derived \d+/i }))
    })

    // The pin is cleared…
    await waitFor(() => {
      const fresh = useUnits.getState().get('pilot', pilot.id)
      expect(fresh?.maxHpOverride).toBeUndefined()
    })

    // …and the revert is an `override` op.
    expect(logged.some((e) => e.kind === 'override' && e.field === 'maxHpOverride')).toBe(true)
  })

  test('a manual adjustment is NOT an override — it contributes to the derivation', async () => {
    // Before the ADR-022 amendment maxHpModifier carried both meanings at once,
    // so a rules-sourced bonus would have rendered as a hand override with a
    // revert button. It is now a contribution: the max rises, no indicator.
    const store = useUnits.getState()
    const pilot = await store.create('pilot', { ...basePilotInput, maxHpModifier: 2 })

    render(<Sheet kind="pilot" id={pilot.id} />)

    // Anchor on the sheet actually being rendered before asserting absence.
    await screen.findByRole('button', { name: /more actions/i })
    expect(screen.queryByText(/overridden from/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /revert hp max/i })).toBeNull()
  })
})
