/** A pattern the reader does not hold is gone once neither its link nor a crew answers for it (r3 G3). */
import { describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { holdWorkerRead } from '../../connection/workerRead'
import { sharedPaths } from '../paths'
import { usePatternGone } from '../reads'

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
