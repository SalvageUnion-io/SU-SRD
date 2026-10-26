/**
 * Sheet pipeline smoke tests — consolidated end-to-end-ish coverage of the
 * entire sheet rendering pipeline.
 *
 * Strategy: dep-injection throughout. Each scenario
 * exercises the Sheet → sub-component → store integration as a whole, rather
 * than testing a single sub-component in isolation.
 *
 * Scenarios (the per-kind renders and the rail live in Sheet.test.tsx):
 *   1.  Stat-edit round-trip via the Sheet hero trackers (VitalGauge)
 *   2.  Top-bar Share entry: the Share button opens ShareStatusDialog in place
 *
 * Conventions:
 *   - toBeTruthy() not toBeInTheDocument() (happy-dom workaround)
 *   - The only module mocks are the server's (`installServerMocks`): the signed-out
 *     Share dialog mounts `SignInControl`
 *   - afterEach cleanup()
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSingleUnitStore,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { must } from '../../../components/__tests__/must'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import { fakeMech, fakePilot } from './sheetFixtures'

// Module scope, before the import below — see `serverMock.ts`.
const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { Sheet } = await import('../Sheet')

// ---------------------------------------------------------------------------
// Preload salvageunion-reference once — MechSheet resolves chassis refs
// ---------------------------------------------------------------------------

beforeAll(hydrateStores)

// ---------------------------------------------------------------------------
// Scenario 1 — Stat-edit round-trip via the Sheet hero trackers
//
// Stat editing lives in the hero VitalGauges now (Sheet.tsx): clicking a
// track segment patches current* fields through the injected store. This
// exercises the Sheet → SheetHero → VitalGauge → store.update pipeline.
// ---------------------------------------------------------------------------

describe('Smoke — stat-edit round-trip (Sheet hero trackers)', () => {
  test('clicking the top SP gauge segment calls store.update with currentSP', async () => {
    const statMech: Mech = {
      ...fakeMech,
      id: 'mech-smoke-stat',
      // Real chassis (Scrapper, SP 9) — the hero derives maxima from the ORM.
      chassisRef: 'scrapper',
      currentSP: 5,
    }
    const captured: Array<{ id: string; patch: Partial<Mech> }> = []
    const store = makeSingleUnitStore('mech', statMech, {
      update: async (_type, id, patch) => {
        captured.push({ id, patch: patch as Partial<Mech> })
        return { ...statMech, ...patch } as Mech
      },
    })

    render(
      <Sheet
        kind="mech"
        id="mech-smoke-stat"
        entityStore={makeEntityLookupMock([statMech])}
        softLinkStore={makeSoftLinkStoreMock([])}
        store={store}
      />
    )

    await act(async () => {
      // SP is a VitalGauge: clicking the top-lit segment (index 4) steps
      // SP 5 → 4 (pipClickValue click-to-set) through the track's slider.
      const sp = screen.getByRole('slider', { name: 'SP' })
      fireEvent.click(must(sp.querySelector('[data-pip-index="4"]')))
    })

    expect(captured.length).toBe(1)
    expect(must(captured[0]).id).toBe('mech-smoke-stat')
    expect(must(captured[0]).patch).toMatchObject({ currentSP: 4 })
  })
})

// ---------------------------------------------------------------------------
// Scenario 2 — top-bar Share entry point
//
// Share is a BUTTON that opens ShareStatusDialog over this sheet, not a link to
// a share screen. That screen was deleted: its left half previewed the very
// sheet you were standing on, and previewed it wrong. What the dialog offers is
// covered in ShareStatusDialog(.connected).test.tsx; this asserts only the
// entry point.
// ---------------------------------------------------------------------------

describe('Smoke — the top-bar Share control opens the share dialog', () => {
  test('Share is a button, and pressing it reveals the share status', async () => {
    render(
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    )

    // It must not navigate — the sheet behind the dialog is the preview.
    expect(screen.queryByRole('link', { name: /share this pilot/i })).toBeNull()
    const share = screen.getByRole('button', { name: /share this pilot/i })

    await act(async () => {
      fireEvent.click(share)
    })
    // Solo here (no provider), so the dialog says what sharing needs.
    expect(await screen.findByText(/sharing needs an account/i)).toBeTruthy()
  })
})
