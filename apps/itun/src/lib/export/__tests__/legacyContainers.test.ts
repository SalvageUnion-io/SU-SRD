import { describe, expect, test } from 'bun:test'

import { parseImportBundle } from '../parseImportBundle'
import { assignContainers, withContainer } from '../legacyContainers'

/** Inlined from the deleted lib/defaultWorkspace.ts (Workspaces are retired). */
const DEFAULT_WORKSPACE_ID = 'default-workspace'

/**
 * Legacy data carried forward (ADR-030 §2).
 *
 * The requirement being protected: a backup taken **before accounts existed**
 * must still import, and must land in the same container the v13 migration
 * would have put it in on the device it came from. A roster that reads
 * differently depending on whether it arrived by migration or by import is the
 * bug this exists to prevent.
 */

describe('withContainer', () => {
  test('the Default workspace becomes the shelf', () => {
    // Same claim as migration 13: it was never a campaign, only where builds
    // went when they belonged to none.
    expect(withContainer({ workspaceId: DEFAULT_WORKSPACE_ID }).gameId).toBeNull()
  })

  test('a real workspace becomes a game of the same id', () => {
    expect(withContainer({ workspaceId: 'campaign-a' }).gameId).toBe('campaign-a')
  })

  test('no workspace at all lands on the shelf', () => {
    expect(withContainer({}).gameId).toBeNull()
  })

  test('an existing gameId is preserved rather than recomputed', () => {
    // A v2 bundle already carries a decision; re-deriving it from a stale
    // workspaceId would move entities somebody had deliberately placed.
    expect(withContainer({ gameId: 'g1', workspaceId: 'old' }).gameId).toBe('g1')
    expect(withContainer({ gameId: null, workspaceId: 'old' }).gameId).toBeNull()
  })

  test('assignContainers maps a whole array', () => {
    const out = assignContainers([{ workspaceId: 'a' }, { workspaceId: DEFAULT_WORKSPACE_ID }, {}])
    expect(out.map((e) => e.gameId)).toEqual(['a', null, null])
  })
})

/** A minimal v1 bundle, shaped as the pre-accounts app wrote them. */
function v1Bundle(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    entities: {
      pilots: [
        {
          id: 'p1',
          schemaVersion: 1,
          name: 'Roach-Boy',
          callsign: 'Roach-Boy',
          classRef: 'salvager',
          abilities: [],
          equipment: [],
          motto: '',
          keepsake: '',
          appearance: '',
          conditions: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          workspaceId: 'campaign-a',
        },
      ],
      mechs: [],
      crawlers: [],
    },
    workspaces: [],
    softLinks: [],
    ...over,
  })
}

describe('importing a pre-accounts backup', () => {
  test('a v1 bundle still parses', () => {
    // The file somebody reaches for after a year away. Refusing it would
    // strand exactly the data this migration exists to carry forward.
    const bundle = parseImportBundle(v1Bundle())
    expect(bundle.entities.pilots).toHaveLength(1)
  })

  test('its entities arrive with a container', () => {
    const bundle = parseImportBundle(v1Bundle())
    const pilot = bundle.entities.pilots[0] as unknown as { gameId: string | null }
    // Not left undecided: an entity with no container is invisible to anything
    // that filters by one.
    expect(pilot.gameId).toBe('campaign-a')
  })

  test('it is normalised to the current version', () => {
    // So the rest of the pipeline sees one format instead of branching on
    // version at every step.
    expect(parseImportBundle(v1Bundle()).schemaVersion).toBe(2)
  })

  test('a Default-workspace entity lands on the shelf', () => {
    const raw = JSON.parse(v1Bundle()) as {
      entities: { pilots: Array<Record<string, unknown>> }
    }
    const first = raw.entities.pilots[0]
    if (first !== undefined) first.workspaceId = DEFAULT_WORKSPACE_ID

    const bundle = parseImportBundle(JSON.stringify(raw))
    const pilot = bundle.entities.pilots[0] as unknown as { gameId: string | null }
    expect(pilot.gameId).toBeNull()
  })

  test('an unknown future version is still refused, with both supported ones named', () => {
    const raw = JSON.parse(v1Bundle()) as Record<string, unknown>
    raw.schemaVersion = 99
    expect(() => parseImportBundle(JSON.stringify(raw))).toThrow(/1, 2/)
  })
})
