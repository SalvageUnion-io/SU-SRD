/**
 * A roll the Mediator asked of a seat (ADR-068 §4): on Play its one press
 * rolls the table and answers the ask; off Play it is the way to that table.
 */

import { afterAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'

const realTable = { ...(await import('../../replica/useTable')) }
const sent: { name: string; args: unknown }[] = []
mock.module('../../replica/useTable', () => ({
  ...realTable,
  useTableAct: (name: string) => async (args: unknown) => {
    sent.push({ name, args })
  },
}))
afterAll(() => {
  mock.module('../../replica/useTable', () => realTable)
})

const { useAskNotices } = await import('../useAskNotices')
const { onPlayTableAsked } = await import('../zeroVital.model')

const ASK = [{ pilotId: 'p1', table: 'Core Mechanic' }]

describe('a roll asked of the seat', () => {
  test('off Play, the way to the seat’s table', () => {
    const { result } = renderHook(() => useAskNotices('g1', ASK, true))
    expect(result.current).toHaveLength(1)
    expect(result.current[0]?.title).toBe('The Mediator asks you to roll Core Mechanic')
    render(<>{result.current[0]?.actions}</>)
    expect(screen.getByRole('link').getAttribute('href')).toContain('p1')
    cleanup()
  })

  test('on Play, one press rolls it and answers the ask', async () => {
    sent.length = 0
    const heard: { name: string; roll: boolean }[] = []
    const stop = onPlayTableAsked((name, ask) => heard.push({ name, roll: ask.roll }))
    const { result } = renderHook(() => useAskNotices('g1', ASK, true))
    render(<>{result.current[0]?.actions}</>)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll Core Mechanic' }))
    })
    expect(heard).toEqual([{ name: 'Core Mechanic', roll: true }])
    expect(sent).toEqual([{ name: 'scenes.answerAsk', args: { pilotId: 'p1' } }])
    stop()
    cleanup()
  })

  test('nothing asked, no notice', () => {
    const { result } = renderHook(() => useAskNotices('g1', undefined, true))
    expect(result.current).toEqual([])
  })
})
