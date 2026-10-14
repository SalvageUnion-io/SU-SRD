import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import type { CompactSearchEntry } from '../searchIndexTypes'
import { resetSearchIndexForTests, useSearchIndex } from '../useSearchIndex'

const ENTRY: CompactSearchEntry = {
  id: 'mule',
  name: 'Mule',
  slug: 'mule',
  schemaName: 'chassis',
  schemaTitle: 'Chassis',
  text: 'mule',
}

const respond = (body: unknown, status = 200): typeof fetch =>
  Object.assign(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    { preconnect: fetch.preconnect }
  )

describe('useSearchIndex', () => {
  let fetchSpy: Mock<typeof fetch> | undefined

  beforeEach(() => {
    resetSearchIndexForTests()
  })

  afterEach(() => {
    fetchSpy?.mockRestore()
    resetSearchIndexForTests()
  })

  test('a failed fetch surfaces as an error, and load() retries with a fresh request', async () => {
    fetchSpy = spyOn(globalThis, 'fetch')
      .mockImplementationOnce(respond('nope', 503))
      .mockImplementationOnce(respond([ENTRY]))

    const { result } = renderHook(() => useSearchIndex())
    await act(async () => {})
    expect(result.current.ready).toBe(false)
    expect(result.current.error?.message).toBe('Failed to load search index: 503')
    expect(result.current.index).toEqual([])

    await act(async () => {
      result.current.load()
    })
    expect(result.current.error).toBeNull()
    expect(result.current.ready).toBe(true)
    expect(result.current.index).toEqual([ENTRY])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  test('deferred, it fetches nothing until load()', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(respond([ENTRY]))
    const { result } = renderHook(() => useSearchIndex({ defer: true }))
    await act(async () => {})
    expect(fetchSpy).not.toHaveBeenCalled()
    await act(async () => {
      result.current.load()
    })
    expect(fetchSpy).toHaveBeenCalledWith('/search-index.json')
    expect(result.current.ready).toBe(true)
  })

  test('a server render is never ready, even once the index is loaded', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(respond([ENTRY]))
    const { result } = renderHook(() => useSearchIndex())
    await act(async () => {})
    expect(result.current.ready).toBe(true)

    function Probe() {
      const { ready } = useSearchIndex({ defer: true })
      return <span>{ready ? 'ready' : 'waiting'}</span>
    }
    expect(renderToString(<Probe />)).toContain('waiting')
  })
})
