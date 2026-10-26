/**
 * An island swapped in over its stand-in must not blank the stand-in before
 * the island draws, nor drop what a reader typed into it, or their focus, at
 * the swap; and it says when its first commit is on the page.
 */

import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { createElement, useState } from 'react'
import type { Root } from 'react-dom/client'
import { hydrateRoot } from 'react-dom/client'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { HeroSearchStatic } from '../../components/HeroSearch'
import { SearchIsland } from '../../components/islands/SearchIsland'
import { resetSearchIndexForTests } from '../../lib/useSearchIndex'
import { captureFormState, clientSwap, restoreFormState } from '../clientSwap'
import { ISLAND_COMMIT } from '../islandCommit'

let host: HTMLElement
let root: Root | undefined

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(async () => {
  // Unmount, so no island outlives its test and answers a later one's events.
  await act(async () => {
    root?.unmount()
  })
  root = undefined
  host.remove()
  ;(document.activeElement as HTMLElement | null)?.blur?.()
})

/** Astro's slot as `@astrojs/react` hands it to an island: its markup, verbatim. */
function slot(markup: string) {
  return createElement('astro-slot', {
    suppressHydrationWarning: true,
    // biome-ignore lint/security/noDangerouslySetInnerHtml: Astro's own slot element, test markup
    dangerouslySetInnerHTML: { __html: markup },
  })
}

/**
 * Serves `Island` over `standIn` as Astro does, server markup first, then
 * hydrates it, returning the served input (if any) for a reader to type into
 * before the hydrate.
 */
function serve<P extends object>(
  Island: ComponentType<P & { children?: ReactNode }>,
  props: P,
  standIn: string
) {
  host.innerHTML = renderToString(<Island {...props}>{slot(standIn)}</Island>)
  return {
    input: host.querySelector('input'),
    hydrate: async () => {
      await act(async () => {
        root = hydrateRoot(host, <Island {...props}>{slot(standIn)}</Island>)
      })
      // The restore runs in a microtask after the commit; let its update land.
      await act(async () => {})
    },
  }
}

/** What a reader does in the server field before the island mounts. */
function typeInto(input: HTMLInputElement, value: string, caret: [number, number]) {
  input.focus()
  input.value = value
  input.setSelectionRange(caret[0], caret[1])
}

/** A controlled field, the shape every SRD island field has. */
function Field() {
  const [value, setValue] = useState('')
  return (
    <label>
      Find
      <input type="text" name="q" value={value} onChange={(e) => setValue(e.target.value)} />
      <output>{value}</output>
    </label>
  )
}

const SwappedField = clientSwap('Field', Field)

describe('clientSwap', () => {
  test('hydrates the stand-in, then replaces it with the island, once', async () => {
    const served = serve(SwappedField, {}, '<p data-static>served</p><input name="q" />')
    expect(host.querySelector('[data-island="Field"][data-standin]')).not.toBeNull()
    await served.hydrate()
    expect(host.querySelector('[data-static]')).toBeNull()
    expect(host.querySelector('[data-standin]')).toBeNull()
    expect(host.querySelectorAll('input')).toHaveLength(1)
  })

  test('carries typed text, focus and caret onto the control of the same name', async () => {
    const served = serve(SwappedField, {}, '<input type="search" name="q" />')
    if (!served.input) throw new Error('no input in the served markup')
    typeInto(served.input, 'gopher', [2, 4])
    await served.hydrate()

    const input = host.querySelector('input')
    expect(input?.value).toBe('gopher')
    // The island's own state took it, not just the DOM.
    expect(host.querySelector('output')?.textContent).toBe('gopher')
    expect(document.activeElement).toBe(input)
    expect([input?.selectionStart, input?.selectionEnd]).toEqual([2, 4])
  })

  describe('the home page hero search', () => {
    let fetchSpy: Mock<typeof fetch> | undefined

    beforeEach(() => {
      // Typing asks for the search index; it never needs to arrive here.
      fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => new Promise<Response>(() => {}), { preconnect: fetch.preconnect })
      )
    })

    afterEach(() => {
      fetchSpy?.mockRestore()
      resetSearchIndexForTests()
    })

    test('keeps what a reader typed into the served field', async () => {
      const served = serve(
        clientSwap('SearchIsland', SearchIsland),
        { variant: 'hero' as const },
        renderToStaticMarkup(<HeroSearchStatic />)
      )
      if (!served.input) throw new Error('no input in the served markup')
      typeInto(served.input, 'hacker', [6, 6])
      await served.hydrate()

      const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')
      expect(input?.value).toBe('hacker')
      expect(document.activeElement).toBe(input)
      expect(input?.selectionStart).toBe(6)
    })
  })
})

describe('clientSwap prepare', () => {
  test('swaps only once what the first render needs is in, then says so', async () => {
    let release = () => {}
    const ready = new Promise<void>((resolve) => {
      release = resolve
    })
    const seen: string[] = []
    host.addEventListener(ISLAND_COMMIT, () => {
      seen.push(host.querySelector('output')?.tagName ?? 'none')
    })
    const served = serve(clientSwap('Field', Field, { prepare: () => ready }), {}, '<i>served</i>')
    await served.hydrate()
    expect(host.querySelector('i')?.textContent).toBe('served')
    await act(async () => {
      release()
      await ready
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(seen).toEqual(['OUTPUT'])
  })

  test('an island with no stand-in draws nothing until it swaps in', () => {
    host.innerHTML = renderToString(<SwappedField />)
    expect(host.innerHTML).toBe('<div data-island="Field" data-standin=""></div>')
  })
})

/** Markup in `host`, with its first input. */
function markup(html: string): HTMLInputElement {
  host.innerHTML = html
  const input = host.querySelector('input')
  if (!input) throw new Error('no input in the markup')
  return input
}

describe('restoreFormState', () => {
  test('leaves focus where the reader has since moved it', () => {
    typeInto(markup('<input name="q" />'), 'x', [1, 1])
    const carried = captureFormState(host)
    host.innerHTML = '<input name="q" />'
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    elsewhere.focus()

    restoreFormState(host, carried)
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })

  test('carries only values the reader changed', () => {
    markup('<input name="q" value="served" />')
    const carried = captureFormState(host)
    expect(carried.values.size).toBe(0)
    expect(carried.focus).toBeNull()
  })
})
