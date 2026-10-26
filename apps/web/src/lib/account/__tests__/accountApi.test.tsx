/**
 * The account's hooks over the Worker's routes: a read is fetched once per
 * signed-in player and shared, a write fetches again what it changed, and a
 * refusal throws in the Worker's own words. `fetch` is a recorder here.
 */

import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import { ACCOUNT_PATHS } from '../../../rooms/routes'

let person: string | null = 'd-1'

const serverMocks = await installServerMocks({
  also: { '../../lib/auth/session': () => ({ useMyPerson: () => person }) },
})
afterAll(() => serverMocks.restore())

const { RoomDeclined } = await import('../../../replica/roomSocket')
const api = await import('../accountApi')

type Asked = { path: string; method: string; body: unknown }
const asked: Asked[] = []
/** What each path answers: a status and a JSON body. */
let answers: Record<string, { status?: number; body: unknown }> = {}
const realFetch = globalThis.fetch

beforeEach(() => {
  asked.length = 0
  answers = {}
  globalThis.fetch = (async (path: string, init?: RequestInit) => {
    asked.push({
      path,
      method: init?.method ?? 'GET',
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    })
    const answer = answers[path] ?? { status: 404, body: null }
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 })
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
  person = 'd-1'
})

const gets = (path: string) => asked.filter((a) => a.path === path && a.method === 'GET')

describe('reads', () => {
  test('who is signed in is asked once and shared by every component asking', async () => {
    person = 'd-shared'
    answers[ACCOUNT_PATHS.me] = { body: { _id: 'u-1', displayName: 'Rosa' } }
    const first = renderHook(() => api.useMe())
    const second = renderHook(() => api.useMe())
    await waitFor(() => expect(first.result.current?.displayName).toBe('Rosa'))
    expect(second.result.current?.displayName).toBe('Rosa')
    expect(gets(ACCOUNT_PATHS.me)).toHaveLength(1)
  })

  test('skipped, or signed out, nothing is asked', async () => {
    renderHook(() => api.useMe(false))
    person = null
    const out = renderHook(() => api.useAccountExport())
    await act(async () => undefined)
    expect(asked).toEqual([])
    expect(out.result.current).toBeUndefined()
  })

  test('an unreachable read stays loading', async () => {
    person = 'd-unreachable'
    answers[ACCOUNT_PATHS.metrics] = { status: 500, body: null }
    const { result } = renderHook(() => api.useAdminMetrics())
    await waitFor(() => expect(gets(ACCOUNT_PATHS.metrics)).toHaveLength(1))
    await act(async () => undefined)
    expect(result.current).toBeUndefined()
  })
})

describe('writes', () => {
  test('a profile change goes up, then who is signed in is asked again', async () => {
    person = 'd-profile'
    answers[ACCOUNT_PATHS.me] = { body: { displayName: 'rosa' } }
    answers[ACCOUNT_PATHS.profile] = { body: null }
    const me = renderHook(() => api.useMe())
    await waitFor(() => expect(me.result.current?.displayName).toBe('rosa'))
    answers[ACCOUNT_PATHS.me] = { body: { displayName: 'Bonesaw' } }
    const update = renderHook(() => api.useUpdateProfile()).result.current
    await act(() => update({ displayName: 'Bonesaw' }))
    expect(asked).toContainEqual({
      path: ACCOUNT_PATHS.profile,
      method: 'POST',
      body: { displayName: 'Bonesaw' },
    })
    await waitFor(() => expect(me.result.current?.displayName).toBe('Bonesaw'))
  })

  test('a refresh takes a snapshot, then the metrics are asked again', async () => {
    person = 'd-admin'
    answers[ACCOUNT_PATHS.metrics] = { body: { snapshot: null, weeks: [] } }
    answers[ACCOUNT_PATHS.refreshMetrics] = { body: null }
    const metrics = renderHook(() => api.useAdminMetrics())
    await waitFor(() => expect(metrics.result.current).toEqual({ snapshot: null, weeks: [] }))
    answers[ACCOUNT_PATHS.metrics] = { body: { snapshot: null, weeks: [{ counts: {} }] } }
    const refresh = renderHook(() => api.useRefreshMetrics()).result.current
    expect(await refresh()).toBeNull()
    await waitFor(() => expect(metrics.result.current?.weeks).toHaveLength(1))
  })

  test('a refusal throws in the Worker’s words; any other failure says which route', async () => {
    const submit = renderHook(() => api.useSubmitFeedback()).result.current
    answers[ACCOUNT_PATHS.feedback] = { status: 400, body: { refusal: 'Say a little more.' } }
    const refused = submit({ kind: 'report', text: 'no' })
    await expect(refused).rejects.toBeInstanceOf(RoomDeclined)
    await expect(refused).rejects.toThrow('Say a little more.')
    answers[ACCOUNT_PATHS.feedback] = { status: 401, body: null }
    await expect(submit({ kind: 'report', text: 'no' })).rejects.toThrow(
      `${ACCOUNT_PATHS.feedback} answered 401`
    )
  })
})

describe('askFloor', () => {
  test('the Worker’s number, or nothing when it cannot be read', async () => {
    answers[ACCOUNT_PATHS.floor] = { body: 1234 }
    expect(await api.askFloor()).toBe(1234)
    answers[ACCOUNT_PATHS.floor] = { body: 'soon' }
    expect(await api.askFloor()).toBeUndefined()
    answers[ACCOUNT_PATHS.floor] = { status: 503, body: null }
    expect(await api.askFloor()).toBeUndefined()
  })
})
