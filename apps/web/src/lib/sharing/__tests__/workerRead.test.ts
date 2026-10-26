/**
 * The Worker's JSON routes as the client reads and writes them
 * (`lib/connection/workerRead.ts`), and the addresses it asks
 * (`../paths.ts`): a value, a refusal the player reads, or a fault.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { RoomDeclined } from '../../../replica/roomSocket'
import {
  dropSharedByLink,
  holdSharedByLink,
  putSharedByLink,
  useSharedByLinkRooms,
} from '../../../replica/sharedByLink'
import { forgetWorkerReads, workerWrite } from '../../connection/workerRead'
import { PHOTOS_PATH, photoPath, sharedPaths } from '../paths'

const realFetch = globalThis.fetch
let answer: Response

beforeEach(() => {
  globalThis.fetch = (async () => answer) as unknown as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
  forgetWorkerReads()
})

describe('a write to a Worker route', () => {
  test('answers its value', async () => {
    answer = Response.json({ value: { hidden: true } })
    expect(
      await workerWrite<{ hidden: boolean }>(sharedPaths.hidden('pat-1'), { hidden: true })
    ).toEqual({
      hidden: true,
    })
  })

  test('a refusal is one the player reads', async () => {
    answer = Response.json({ refusal: 'Only a site admin can do that' }, { status: 403 })
    const refused = workerWrite(sharedPaths.hidden('pat-1'), { hidden: true })
    expect(refused).rejects.toBeInstanceOf(RoomDeclined)
    expect(refused).rejects.toThrow('Only a site admin can do that')
  })

  test('a fault is not a refusal', async () => {
    answer = new Response('down', { status: 503 })
    expect(workerWrite(sharedPaths.dismiss('pat-1'))).rejects.not.toBeInstanceOf(RoomDeclined)
  })
})

describe('the addresses', () => {
  test('a photo is served under its key, escaped', () => {
    expect(photoPath('a b.webp')).toBe(`${PHOTOS_PATH}/a%20b.webp`)
  })
})

describe('which units are shared by link', () => {
  test('one unit changes, or leaves, after its room’s snapshot', () => {
    const { result } = renderHook(() => useSharedByLinkRooms())
    // Other rooms' units may be held too; this asks only after `p1`.
    act(() => holdSharedByLink('account', [{ appId: 'p1', publicRead: false }]))
    expect(result.current).not.toContain('p1')
    act(() => putSharedByLink('account', { appId: 'p1', publicRead: true }))
    expect(result.current).toContain('p1')
    act(() => dropSharedByLink('account', 'p1'))
    expect(result.current).not.toContain('p1')
  })
})
