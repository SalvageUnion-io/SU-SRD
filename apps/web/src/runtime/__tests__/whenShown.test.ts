import { describe, expect, mock, test } from 'bun:test'
import { whenShown } from '../whenShown'

/** A document that is or is not a prerender, keeping the listeners it is given. */
function doc(prerendering: boolean) {
  const listeners: ((event: Event) => void)[] = []
  return {
    listeners,
    doc: {
      prerendering,
      addEventListener: (_type: 'prerenderingchange', listener: () => void) => {
        listeners.push(listener)
      },
    },
  }
}

describe('whenShown', () => {
  test('runs the work now on a page the reader is looking at', () => {
    const work = mock(() => {})
    whenShown(work, doc(false).doc)
    expect(work).toHaveBeenCalledTimes(1)
  })

  test('waits for a prerendered page to be shown', () => {
    const work = mock(() => {})
    const page = doc(true)
    whenShown(work, page.doc)
    expect(work).not.toHaveBeenCalled()
    for (const listener of page.listeners) listener(new Event('prerenderingchange'))
    expect(work).toHaveBeenCalledTimes(1)
  })

  test('never hands the work the prerenderingchange Event', () => {
    // registerSiteWorker(host = window) took the Event as its host and threw
    // reading `serviceWorker` on every prerendered reference page (4.7.0).
    const work = mock((..._args: unknown[]) => {})
    const page = doc(true)
    whenShown(work, page.doc)
    for (const listener of page.listeners) listener(new Event('prerenderingchange'))
    expect(work.mock.calls[0]).toEqual([])
  })
})
