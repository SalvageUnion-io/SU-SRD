/**
 * "Download all" for somebody who is not signed in.
 *
 * Signed out, the app is read-only (ADR-034 as amended): nothing can be built, so
 * an anonymous backup has nothing of the session's to carry. The replica holds
 * rows on the device only while signed in, and a session's end drops them (`clear`),
 * so the last account's rows never reach a signed-out backup.
 *
 * Runs on the default (anonymous) backend on purpose: no `withSignedInBackend`,
 * and the anonymous state set before each test.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { usePatterns } from '../../../replica/collections'
import { clear } from '../../../replica/replica'
import { resetSync, syncStatus } from '../../../replica/sync'
import { useUnits } from '../../../replica/units'
import { buildExportBundle } from '../buildExportBundle'

const patternInput = {
  schemaVersion: 1 as const,
  name: 'Anonymous Loadout',
  chassisRef: 'Mule Chassis',
  systems: [],
  modules: [],
  cargoLots: [],
}

beforeEach(resetStores)
// The anonymous backend, pinned: a connected screen's test earlier in the
// process (SettingsScreen, WizardGameChip) can leave its session signed in.
beforeEach(() => resetSync())

describe('an anonymous backup', () => {
  test('saves no pattern, so carries none', async () => {
    expect(syncStatus()).toBe('signedOut')
    await expect(usePatterns.getState().create(patternInput)).rejects.toThrow(/Sign in/)

    const bundle = await buildExportBundle(useUnits.getState())

    expect(bundle.mechPatterns).toEqual([])
  })

  test('carries none of the last session’s rows once that session ended', async () => {
    // A row the last account's subscription delivered; folding it in here would
    // hand the visitor a backup whose contents they cannot see anywhere in the
    // app.
    await usePatterns.getState().adopt({
      ...patternInput,
      name: 'Last session',
      id: crypto.randomUUID(),
      createdAt: FIXTURE_NOW,
    })
    expect(usePatterns.getState().mechPatterns).toHaveLength(1)

    clear()
    const bundle = await buildExportBundle(useUnits.getState())

    expect(bundle.mechPatterns).toEqual([])
  })
})
