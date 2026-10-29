/**
 * The Games hooks against a stand-in Worker: a call goes to `POST
 * /__rooms/call` by name, a refusal comes back as `RoomDeclined`, a read is
 * kept per arguments and fetched again on a room change, and a write carries
 * its screen's scope and has every read fetched again once it lands.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ROOMS_CALL_PATH } from '../../rooms/routes'
import {
  forgetGamesAnswers,
  RoomUnreachable,
  roomCall,
  useGamesCall,
  useGamesQuery,
} from '../roomCalls'
import { noteRoomChange } from '../roomChanges'
import { RoomDeclined } from '../roomSocket'

type Sent = { url: string; name: string; args: unknown }

const realFetch = globalThis.fetch
let sent: Sent[] = []
let answer: (name: string) => { status?: number; body: unknown } = () => ({
  body: { ok: true, value: [] },
})

beforeEach(() => {
  sent = []
  forgetGamesAnswers()
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const { name, args } = JSON.parse(init.body as string) as { name: string; args: unknown }
    sent.push({ url, name, args })
    const { status = 200, body } = answer(name)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  answer = () => ({ body: { ok: true, value: [] } })
})

describe('roomCall', () => {
  test('posts the call by name and answers its value', async () => {
    answer = () => ({ body: { ok: true, value: 'ABC' } })
    expect(await roomCall('invites.link', { gameId: 'g1' })).toBe('ABC')
    expect(sent).toEqual([{ url: ROOMS_CALL_PATH, name: 'invites.link', args: { gameId: 'g1' } }])
  })

  test('a refusal is a RoomDeclined with the player-facing words', async () => {
    answer = () => ({ body: { ok: false, refusal: 'Sign in first' } })
    const call = roomCall('games.listMine', {})
    await expect(call).rejects.toBeInstanceOf(RoomDeclined)
    await expect(call).rejects.toThrow('Sign in first')
  })

  test('a failed request throws with the call it was', async () => {
    answer = () => ({ status: 500, body: { error: 'call_failed' } })
    await expect(roomCall('games.listMine', {})).rejects.toThrow('games.listMine answered 500')
  })

  test('a request that never reached the server is a RoomUnreachable', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Load failed')
    }) as unknown as typeof fetch
    const call = roomCall('games.listMine', {})
    await expect(call).rejects.toBeInstanceOf(RoomUnreachable)
    await expect(call).rejects.toThrow('games.listMine did not reach the server')
  })
})

describe('useGamesQuery', () => {
  test('is undefined until the answer, then the answer', async () => {
    answer = () => ({ body: { ok: true, value: [{ _id: 'g1' }] } })
    const { result } = renderHook(() => useGamesQuery('games.listMine', {}))
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toEqual([{ _id: 'g1' }] as never))
  })

  test('forgets its answer when the session ends, so the next account never reads it', async () => {
    answer = () => ({ body: { ok: true, value: [{ _id: 'g1' }] } })
    const { result } = renderHook(() => useGamesQuery('games.listMine', {}))
    await waitFor(() => expect(result.current).toEqual([{ _id: 'g1' }] as never))
    act(() => forgetGamesAnswers())
    expect(result.current).toBeUndefined()
  })

  test('a skipped read sends nothing', async () => {
    const { result } = renderHook(() => useGamesQuery('games.get', 'skip'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(result.current).toBeUndefined()
    expect(sent).toEqual([])
  })

  test('two screens on one read share one fetch', async () => {
    renderHook(() => useGamesQuery('games.members', { gameId: 'g1' }))
    const { result } = renderHook(() => useGamesQuery('games.members', { gameId: 'g1' }))
    await waitFor(() => expect(result.current).toEqual([]))
    expect(sent.length).toBe(1)
  })

  test('a room change fetches it again', async () => {
    let round = 0
    answer = () => ({ body: { ok: true, value: { round: ++round } } })
    const { result } = renderHook(() => useGamesQuery('games.get', { gameId: 'g1' }))
    await waitFor(() => expect(result.current).toEqual({ round: 1 } as never))
    act(() => noteRoomChange())
    await waitFor(() => expect(result.current).toEqual({ round: 2 } as never))
  })

  test('a refused read keeps the last answer', async () => {
    let refuse = false
    answer = () =>
      refuse ? { body: { ok: false, refusal: 'No' } } : { body: { ok: true, value: { kept: 1 } } }
    const { result } = renderHook(() => useGamesQuery('games.get', { gameId: 'g2' }))
    await waitFor(() => expect(result.current).toEqual({ kept: 1 } as never))
    refuse = true
    act(() => noteRoomChange())
    await waitFor(() => expect(sent.length).toBe(2))
    expect(result.current).toEqual({ kept: 1 } as never)
  })
})

describe('useGamesCall', () => {
  test('sends its scope under the call’s own arguments', async () => {
    answer = () => ({ body: { ok: true, value: null } })
    const { result } = renderHook(() => useGamesCall('ownership.assign', { gameId: 'g1' }))
    await act(() => result.current({ entityId: 'p1' }))
    expect(sent).toEqual([
      { url: ROOMS_CALL_PATH, name: 'ownership.assign', args: { gameId: 'g1', entityId: 'p1' } },
    ])
  })

  test('every read is fetched again once a write lands, refused or not', async () => {
    let round = 0
    answer = (name) =>
      name === 'games.destroy'
        ? { body: { ok: false, refusal: 'Only the Organizer can end a Game' } }
        : { body: { ok: true, value: { round: ++round } } }
    const read = renderHook(() => useGamesQuery('games.get', { gameId: 'g3' }))
    await waitFor(() => expect(read.result.current).toEqual({ round: 1 } as never))
    const write = renderHook(() => useGamesCall('games.destroy'))
    await act(async () => {
      await expect(write.result.current({ gameId: 'g3' })).rejects.toBeInstanceOf(RoomDeclined)
    })
    await waitFor(() => expect(read.result.current).toEqual({ round: 2 } as never))
  })
})
