/**
 * v12 → v13 fixture test: workspaceId → gameId (ADR-030 §2).
 *
 * A migration is the one edit a user cannot undo, so this seeds a real v12
 * database and re-opens it through the live upgrade path rather than calling
 * `migrate()` directly — the thing worth proving is that the ladder produces
 * the right containers end to end, not that one function does.
 *
 * The claim under test is that the built-in Default workspace becomes the
 * **shelf** rather than a Game. Getting that backwards would invent a campaign
 * nobody ran and put every unassigned build into it.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { DEFAULT_WORKSPACE_ID } from '../../defaultWorkspace'
import { containerOf } from '../../container'
import { openItunDatabase } from '../index'

const TEST_DB_NAME = 'itun-test-v12-to-v13'

async function destroy(): Promise<void> {
  const { deleteDB } = await import('idb')
  await deleteDB(TEST_DB_NAME)
}

beforeEach(destroy)
afterEach(destroy)

/** Seed a v12-shaped database with pilots in three different container states. */
async function seedV12(): Promise<void> {
  const { openDB } = await import('idb')
  const db = await openDB(TEST_DB_NAME, 12, {
    upgrade(db) {
      for (const name of [
        'pilots',
        'mechs',
        'crawlers',
        'workspaces',
        'softLinks',
        'mechPatterns',
        'encounterNpcs',
      ]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('changeLog')) {
        db.createObjectStore('changeLog', { keyPath: 'seq', autoIncrement: true })
      }
    },
  })

  const base = { schemaVersion: 1, createdAt: '2026-01-01T00:00:00.000Z' }
  await db.put('pilots', {
    ...base,
    id: 'p-default',
    name: 'Shelved',
    workspaceId: DEFAULT_WORKSPACE_ID,
  })
  await db.put('pilots', {
    ...base,
    id: 'p-campaign',
    name: 'In a game',
    workspaceId: 'campaign-a',
  })
  await db.put('pilots', { ...base, id: 'p-none', name: 'No workspace' })
  await db.put('mechs', { ...base, id: 'm-campaign', name: 'Mule', workspaceId: 'campaign-a' })
  await db.put('crawlers', {
    ...base,
    id: 'c-default',
    name: '#430',
    workspaceId: DEFAULT_WORKSPACE_ID,
  })
  db.close()
}

/**
 * Re-open through the app's own opener and read a row back.
 *
 * Deliberately `openItunDatabase` rather than a hand-rolled `openDB` upgrade
 * callback: the first draft of this test wrote its own callback and every case
 * failed with `AbortError`, because the migrations were fired without being
 * awaited and the versionchange transaction auto-committed underneath them.
 * Using the real opener tests the real ladder and cannot drift from it.
 */
async function readAfterUpgrade(store: string, id: string): Promise<Record<string, unknown>> {
  const db = await openItunDatabase(TEST_DB_NAME)
  const row = (await db.get(store, id)) as Record<string, unknown>
  db.close()
  return row
}

describe('v12 → v13 container split', () => {
  test('the Default workspace becomes the shelf, not a game', async () => {
    await seedV12()
    const row = await readAfterUpgrade('pilots', 'p-default')

    expect(row.gameId).toBeNull()
    expect(containerOf(row).kind).toBe('shelf')
  })

  test('a real workspace becomes a game of the same id', async () => {
    await seedV12()
    const row = await readAfterUpgrade('pilots', 'p-campaign')

    expect(row.gameId).toBe('campaign-a')
    expect(containerOf(row)).toEqual({ kind: 'game', gameId: 'campaign-a' })
  })

  test('an entity with no workspace at all lands on the shelf', async () => {
    await seedV12()
    const row = await readAfterUpgrade('pilots', 'p-none')

    // null, not undefined — the record now carries a decision.
    expect(row.gameId).toBeNull()
  })

  test('mechs and crawlers migrate too, not just pilots', async () => {
    await seedV12()
    expect((await readAfterUpgrade('mechs', 'm-campaign')).gameId).toBe('campaign-a')
    expect((await readAfterUpgrade('crawlers', 'c-default')).gameId).toBeNull()
  })

  test('workspaceId is retained, not stripped', async () => {
    await seedV12()
    const row = await readAfterUpgrade('pilots', 'p-campaign')

    // The schemas are `.strict()`, so a row written here still has to parse on
    // a build that predates the migration. Dropping the key is a separate,
    // irreversible follow-up.
    expect(row.workspaceId).toBe('campaign-a')
  })

  test('re-running is idempotent and never moves a placed entity', async () => {
    await seedV12()
    await readAfterUpgrade('pilots', 'p-campaign')

    // Deliberately shelve it, then re-open: the migration must not drag it back
    // to the old workspace on a second pass.
    const db = await openItunDatabase(TEST_DB_NAME)
    const existing = (await db.get('pilots', 'p-campaign')) as Record<string, unknown>
    await db.put('pilots', { ...existing, gameId: null })
    db.close()

    const row = await readAfterUpgrade('pilots', 'p-campaign')
    expect(row.gameId).toBeNull()
  })
})
