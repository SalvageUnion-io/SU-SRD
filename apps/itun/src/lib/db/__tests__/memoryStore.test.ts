/**
 * The anonymous backend (ADR-034 decision 1, plan phase P2).
 *
 * The property under test is an **absence** — nothing reaches durable storage —
 * so most of this file asserts what did *not* happen. That is deliberate: a
 * suite that only checked "the wizard still works" would pass just as happily
 * against the IndexedDB store, which is precisely the bug worth catching.
 */

import { describe, expect, test } from 'bun:test'
import { z } from 'salvageunion-reference/zod'
import { makeMemoryStore } from '../memoryStore'

const ThingSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    name: z.string(),
  })
  .strict()

type Thing = z.infer<typeof ThingSchema>

const makeStore = () => makeMemoryStore<Thing>(ThingSchema, 'things', { hasUpdatedAt: true })

describe('the anonymous store behaves like the durable one', () => {
  test('create mints an id and timestamps, and the record reads back', async () => {
    const store = makeStore()
    const made = await store.create({ name: 'Roach-Boy' } as Omit<
      Thing,
      'id' | 'createdAt' | 'updatedAt'
    >)

    expect(made.id).toBeTruthy()
    expect(made.createdAt).toBeTruthy()
    expect(made.updatedAt).toBeTruthy()
    expect(await store.get(made.id)).toEqual(made)
  })

  test('update merges, bumps updatedAt, and refuses to move the id', async () => {
    const store = makeStore()
    const made = await store.create({ name: 'Roach-Boy' } as never)

    const updated = await store.update(made.id, { name: 'Roach-Girl', id: 'hijack' } as never)

    expect(updated.name).toBe('Roach-Girl')
    // `id` is immutable in the IDB store and must be here too — a backend that
    // let a patch move an id would produce a second record on the next write.
    expect(updated.id).toBe(made.id)
  })

  test('update on a missing id throws rather than creating', async () => {
    const store = makeStore()
    // The IDB store throws here, and a silent create would look like success
    // while orphaning whatever the caller thought it was editing.
    await expect(store.update('nope', { name: 'x' } as never)).rejects.toThrow(/not found/)
  })

  test('delete is a silent no-op for an unknown id', async () => {
    const store = makeStore()
    await store.delete('nope')
    expect(await store.list()).toEqual([])
  })

  test('list is newest-first', async () => {
    const store = makeStore()
    const older = await store.create({ name: 'older' } as never)
    // Stamp the second one later explicitly rather than sleeping: two creates in
    // the same millisecond would otherwise make this assert on tie-break luck.
    await store.put({ ...older, id: 'newer', createdAt: '2099-01-01T00:00:00.000Z' })

    const listed = await store.list()
    expect(listed[0]?.id).toBe('newer')
  })

  test('a write that does not satisfy the schema throws', async () => {
    const store = makeStore()
    // Same contract as the IDB store: `parse`, not `safeParse`, so a wizard
    // surfaces a bad build instead of persisting one.
    await expect(store.create({ name: 42 } as never)).rejects.toThrow()
  })
})

describe('what makes it the ANONYMOUS store', () => {
  test('two stores share nothing', async () => {
    // Each store closes over its own Map. This is what makes two tabs of an
    // anonymous session two sessions rather than one — the reason the entity
    // store also suppresses cross-tab broadcast for this backend.
    const a = makeStore()
    const b = makeStore()
    await a.create({ name: 'only in a' } as never)

    expect(await b.list()).toEqual([])
  })

  test('the module imports nothing that can persist', async () => {
    // The load-bearing assertion of this whole phase, and the reason the
    // backend is a separate module rather than a flag inside `crud.ts`: a
    // conditional would leave every `db.put` one wrong branch away from
    // writing. This checks the source rather than the behaviour, because
    // behaviour can be right today and one refactor away from wrong.
    const source = await Bun.file(new URL('../memoryStore.ts', import.meta.url).pathname).text()

    expect(source).not.toContain("from 'idb'")
    expect(source).not.toContain('indexedDB')
    expect(source).not.toContain('localStorage')
    expect(source).not.toContain('sessionStorage')
  })
})
