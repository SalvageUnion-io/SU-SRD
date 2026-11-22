/**
 * An encounter's text saves itself (r6 B2): once typing rests, on leaving the
 * field, when the page is hidden; a refusal says Not saved and tries again.
 * The timer is the test's own, so nothing waits on a real one.
 */

import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { TEXT_AUTOSAVE_MS, useAutosavedText } from '../useAutosavedText'

function harness(outcome: () => Promise<unknown> = async () => undefined) {
  const saved: string[] = []
  const timers: { run: () => void; ms: number; live: boolean }[] = []
  const schedule = (run: () => void, ms: number) => {
    const timer = { run, ms, live: true }
    timers.push(timer)
    return () => {
      timer.live = false
    }
  }
  const hook = renderHook(() =>
    useAutosavedText({
      kept: 'Kept.',
      save: (text) => {
        saved.push(text)
        return outcome()
      },
      schedule,
    })
  )
  const rest = async () => {
    await act(async () => {
      for (const t of timers.filter((t) => t.live)) {
        t.live = false
        t.run()
      }
    })
  }
  return { hook, saved, timers, rest }
}

describe('useAutosavedText', () => {
  test('typing shows the draft at once and saves the last of it once typing rests', async () => {
    const { hook, saved, timers, rest } = harness()
    expect(hook.result.current.value).toBe('Kept.')
    act(() => hook.result.current.change('A'))
    act(() => hook.result.current.change('Ab'))
    expect(hook.result.current.value).toBe('Ab')
    expect(hook.result.current.state).toBe('saving')
    expect(timers.at(-1)?.ms).toBe(TEXT_AUTOSAVE_MS)
    expect(saved).toEqual([])
    await rest()
    expect(saved).toEqual(['Ab'])
    expect(hook.result.current.state).toBe('saved')
  })

  test('leaving the field or hiding the page saves at once, and only once', async () => {
    const { hook, saved } = harness()
    act(() => hook.result.current.change('Left'))
    await act(async () => hook.result.current.flush())
    await act(async () => hook.result.current.flush())
    expect(saved).toEqual(['Left'])
    act(() => hook.result.current.change('Hidden'))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(saved).toEqual(['Left', 'Hidden'])
  })

  test('a refusal says Not saved, and the next leave tries again', async () => {
    let refuse = true
    const { hook, saved } = harness(async () => {
      if (refuse) throw new Error('offline')
    })
    act(() => hook.result.current.change('Try'))
    await act(async () => hook.result.current.flush())
    expect(hook.result.current.state).toBe('failed')
    refuse = false
    await act(async () => hook.result.current.flush())
    expect(saved).toEqual(['Try', 'Try'])
    expect(hook.result.current.state).toBe('saved')
  })

  test('unmounting saves what is unsaved', async () => {
    const { hook, saved } = harness()
    act(() => hook.result.current.change('Going'))
    hook.unmount()
    expect(saved).toEqual(['Going'])
  })
})
