/**
 * "Download all" for somebody who is not signed in.
 *
 * Signed out, the app is read-only (ADR-034 as amended): nothing can be built, so
 * an anonymous backup has nothing of the session's to carry. The stores hold
 * rows in memory only, and a session's end drops them (`forgetLoadedRows`),
 * so the last account's rows never reach a signed-out backup.
 *
 * Runs on the default (anonymous) backend on purpose: no `withSignedInBackend`.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../stores/__tests__/resetStores'
import { selectBackend } from '../../../stores/entityBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { usePatternStore } from '../../../stores/patternStore'
import { forgetLoadedRows } from '../../../stores/sessionRows'
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

describe('an anonymous backup', () => {
  test('saves no pattern, so carries none', async () => {
    expect(selectBackend()).toBe('signedOut')
    await expect(usePatternStore.getState().create(patternInput)).rejects.toThrow(/Sign in/)

    const bundle = await buildExportBundle(useEntityStore.getState())

    expect(bundle.mechPatterns).toEqual([])
  })

  test('carries none of the last session’s rows once that session ended', async () => {
    // A row the last account's subscription delivered; folding it in here would
    // hand the visitor a backup whose contents they cannot see anywhere in the
    // app.
    await usePatternStore.getState().adopt({
      ...patternInput,
      name: 'Last session',
      id: crypto.randomUUID(),
      createdAt: FIXTURE_NOW,
    })
    expect(usePatternStore.getState().mechPatterns).toHaveLength(1)

    forgetLoadedRows()
    const bundle = await buildExportBundle(useEntityStore.getState())

    expect(bundle.mechPatterns).toEqual([])
  })
})
