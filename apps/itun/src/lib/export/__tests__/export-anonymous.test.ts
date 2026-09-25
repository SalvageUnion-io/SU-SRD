/**
 * "Download all" for somebody who is not signed in.
 *
 * ADR-034 makes export the load-bearing way out for a visitor who will not make
 * an account, so it has to read what that visitor actually built — which lives
 * in the in-memory backend, not in IndexedDB. The bundle's pattern and NPC
 * sources used to default to the IndexedDB tables, so an anonymous backup
 * carried the builds and silently dropped every saved pattern.
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
  test('carries the patterns saved this session', async () => {
    expect(selectBackend()).toBe('memory')
    await usePatternStore.getState().create(patternInput)

    const bundle = await buildExportBundle(useEntityStore.getState())

    expect(bundle.mechPatterns.map((p) => p.name)).toEqual(['Anonymous Loadout'])
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
