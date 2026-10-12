/**
 * The D9 spike's in-memory cache runs the real CRUD layer (`crud.ts`) and
 * `atomicWrite`'s transaction shape — the two callers it stands in for.
 */

import { describe, expect, test } from 'bun:test'
import { PilotSchema } from '../../schemas/pilot'
import { makeStore } from '../crud'
import { openMemoryDatabase } from '../memoryDb'

describe('openMemoryDatabase (D9 spike)', () => {
  test('starts empty and serves makeStore reads and deletes', async () => {
    const db = openMemoryDatabase(['pilots'])
    const pilots = makeStore(async () => db, PilotSchema, 'pilots', { hasUpdatedAt: true })
    expect(await pilots.list()).toEqual([])

    const row = { id: 'p-1', createdAt: '2026-01-01T00:00:00.000Z' }
    await db.put('pilots', row)
    expect(await db.get('pilots', row.id)).toEqual(row)
    await pilots.delete(row.id)
    expect(await db.getAll('pilots')).toEqual([])
  })

  test('a transaction writes through to the same stores', async () => {
    const db = openMemoryDatabase(['a', 'b'])
    const tx = db.transaction(['a', 'b'], 'readwrite')
    await tx.objectStore('a').put({ id: 'x' })
    await tx.objectStore('b').put({ id: 'y' })
    await tx.done
    expect(await db.getAll('a')).toEqual([{ id: 'x' }])
    await db.transaction(['a'], 'readwrite').objectStore('a').clear()
    expect(await db.getAll('a')).toEqual([])
    expect(await db.getAll('b')).toEqual([{ id: 'y' }])
  })

  test('a fresh database shares nothing with an earlier one', async () => {
    const first = openMemoryDatabase(['a'])
    await first.put('a', { id: 'x' })
    expect(await openMemoryDatabase(['a']).getAll('a')).toEqual([])
  })
})
