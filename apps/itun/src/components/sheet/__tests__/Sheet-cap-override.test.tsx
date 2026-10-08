/**
 * Cap-override integration (P2.2 / ADR-022): a Live-Sheet stat gauge with a
 * hand-pinned maximum shows an "overridden from N" indicator + a one-click
 * revert, and reverting clears the max*Modifier delta while logging an
 * `override` Change Log entry. Exercises the real store + db against
 * fake-indexeddb (preloaded via bunfig.toml), with the Convex client a
 * recorder of the Change Log batches the store sends.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { installConvexMocks } from '../../__tests__/convexMock'

const logged: { kind: string; field: string }[] = []

const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (ref: unknown, args: { entries?: { kind: string; field: string }[] }) => {
      if (getFunctionName(ref as FunctionReference<'mutation'>) === 'changeLog:appendChangeLog') {
        logged.push(...(args.entries ?? []))
        return null
      }
      return { updatedAt: 1 }
    },
  },
})

const { _resetDbSingleton, clearCache } = await import('../../../lib/db/index')
const { withSignedInBackend } = await import('../../../stores/__tests__/signedInBackend')
const { useEntityStore } = await import('../../../stores/entityStore')
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

function resetEntityStore(): void {
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
}

beforeEach(async () => {
  logged.length = 0
  _resetDbSingleton()
  await clearCache()
  resetEntityStore()
})

describe('Live Sheet — cap override (P2.2)', () => {
  test('a pinned HP max shows the indicator; revert clears it and logs an override', async () => {
    const store = useEntityStore.getState()
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
      const fresh = useEntityStore.getState().get('pilot', pilot.id)
      expect(fresh?.maxHpOverride).toBeUndefined()
    })

    // …and the revert is recorded as an `override` Change Log entry.
    expect(logged.some((e) => e.kind === 'override' && e.field === 'maxHpOverride')).toBe(true)
  })

  test('a manual adjustment is NOT an override — it contributes to the derivation', async () => {
    // Before the ADR-022 amendment maxHpModifier carried both meanings at once,
    // so a rules-sourced bonus would have rendered as a hand override with a
    // revert button. It is now a contribution: the max rises, no indicator.
    const store = useEntityStore.getState()
    const pilot = await store.create('pilot', { ...basePilotInput, maxHpModifier: 2 })

    render(<Sheet kind="pilot" id={pilot.id} />)

    // Anchor on the sheet actually being rendered before asserting absence.
    await screen.findByRole('button', { name: /more actions/i })
    expect(screen.queryByText(/overridden from/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /revert hp max/i })).toBeNull()
  })
})
