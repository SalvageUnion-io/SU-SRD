/** A pattern the reader does not hold is gone once neither its link nor a crew answers for it (r3 G3). */
import { describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { holdWorkerRead } from '../../connection/workerRead'
import { sharedPaths } from '../paths'
import { usePatternElsewhere, usePatternGone } from '../reads'

const crew = (appIds: string[]) =>
  holdWorkerRead(
    sharedPaths.crewPatterns(),
    appIds.map((appId) => ({ appId, body: {}, madeBy: 'Sam', gameId: 'g1', gameName: 'The Run' }))
  )

describe('usePatternGone', () => {
  test('nothing by link and no crew sharing it: gone', () => {
    holdWorkerRead(sharedPaths.sheet('pattern', 'gone-1'), null)
    crew([])
    expect(renderHook(() => usePatternGone('gone-1', true)).result.current).toBe(true)
  })

  test('readable by link, or shared by a crew: not gone', () => {
    holdWorkerRead(sharedPaths.sheet('pattern', 'linked-1'), { appId: 'linked-1', body: {} })
    holdWorkerRead(sharedPaths.sheet('pattern', 'crew-1'), null)
    crew(['crew-1'])
    expect(renderHook(() => usePatternGone('linked-1', true)).result.current).toBe(false)
    expect(renderHook(() => usePatternGone('crew-1', true)).result.current).toBe(false)
  })

  test('not asked, it claims nothing', () => {
    holdWorkerRead(sharedPaths.sheet('pattern', 'gone-2'), null)
    crew([])
    expect(renderHook(() => usePatternGone('gone-2', false)).result.current).toBe(false)
    expect(renderHook(() => usePatternGone(undefined, true)).result.current).toBe(false)
  })
})

describe('usePatternElsewhere (r5 D3)', () => {
  const body = (id: string, name: string) => ({
    id,
    schemaVersion: 1,
    name,
    chassisRef: 'mule',
    systems: [],
    modules: [],
    createdAt: '2026-11-01T10:00:00.000Z',
  })

  test('names a pattern read by its link, or shared by a crew', () => {
    holdWorkerRead(sharedPaths.sheet('pattern', 'link-9'), {
      appId: 'link-9',
      body: body('link-9', 'Digger'),
    })
    holdWorkerRead(sharedPaths.sheet('pattern', 'crew-9'), null)
    holdWorkerRead(sharedPaths.crewPatterns(), [
      {
        appId: 'crew-9',
        body: body('crew-9', 'Hauler'),
        madeBy: 'Sam',
        gameId: 'g1',
        gameName: 'The Run',
      },
    ])
    expect(renderHook(() => usePatternElsewhere('link-9', true)).result.current?.name).toBe(
      'Digger'
    )
    expect(renderHook(() => usePatternElsewhere('crew-9', true)).result.current?.name).toBe(
      'Hauler'
    )
  })

  test('not asked, or answered by neither: nothing', () => {
    holdWorkerRead(sharedPaths.sheet('pattern', 'none-9'), null)
    crew([])
    expect(renderHook(() => usePatternElsewhere('none-9', true)).result.current).toBeUndefined()
    expect(renderHook(() => usePatternElsewhere('link-9', false)).result.current).toBeUndefined()
  })
})
