/**
 * "Download all" for somebody who is not signed in.
 *
 * Signed out, ITUN is read-only (ADR-034 as amended): nothing can be built, so
 * an anonymous backup has nothing of the session's to carry — and it must not
 * reach into IndexedDB for rows the visitor cannot see.
 *
 * Runs on the default (anonymous) backend on purpose: no `withSignedInBackend`.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { selectBackend } from '../../../stores/entityBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { usePatternStore } from '../../../stores/patternStore'
import { _clearAllStores, _resetDbSingleton, mechPatterns } from '../../db/index'
import { buildExportBundle } from '../buildExportBundle'

const patternInput = {
  schemaVersion: 1 as const,
  name: 'Anonymous Loadout',
  chassisRef: 'Mule Chassis',
  systems: [],
  modules: [],
  cargoLots: [],
}

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  usePatternStore.setState({ mechPatterns: [], hydrated: false })
})

describe('an anonymous backup', () => {
  test('saves no pattern, so carries none', async () => {
    expect(selectBackend()).toBe('signedOut')
    await expect(usePatternStore.getState().create(patternInput)).rejects.toThrow(/Sign in/)

    const bundle = await buildExportBundle(useEntityStore.getState())

    expect(bundle.mechPatterns).toEqual([])
  })

  test('does not reach into IndexedDB for rows the session never built', async () => {
    // A pre-account roster on disk is exported by its own path
    // (`buildLegacyExportBundle`); folding it in here would hand the visitor a
    // backup whose contents they cannot see anywhere in the app.
    await mechPatterns.create({ ...patternInput, name: 'On disk' })

    const bundle = await buildExportBundle(useEntityStore.getState())

    expect(bundle.mechPatterns).toEqual([])
  })
})
