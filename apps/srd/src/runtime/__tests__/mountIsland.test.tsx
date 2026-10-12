/**
 * Mounting an island must not blank its server markup before the island draws,
 * nor drop what a reader typed into it, or their focus, at the swap.
 */

import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act } from '@testing-library/react'
import { useState } from 'react'
import type { Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeroSearchStatic } from '../../components/HeroSearch'
import { SearchIsland } from '../../components/islands/SearchIsland'
import { resetSearchIndexForTests } from '../../lib/useSearchIndex'
import type { IslandComponent } from '../islandRegistry'
import { captureFormState, mountIsland, restoreFormState } from '../mountIsland'

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

/** Server markup in the placeholder, as `<Island ssr>` would serve it. */
function serve(markup: string): HTMLInputElement {
  host.innerHTML = markup
  const input = host.querySelector('input')
  if (!input) throw new Error('no input in the served markup')
  return input
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

async function mount(Component: IslandComponent, props: Record<string, unknown> = {}) {
  await act(async () => {
    root = mountIsland(host, Component, props)
  })
  // The restore runs in a microtask after the commit; let its update land.
  await act(async () => {})
}

describe('mountIsland', () => {
  test('replaces the server markup with the island, once', async () => {
    serve('<p data-static>served</p><input name="q" />')
    await mount(Field as IslandComponent)
    expect(host.querySelector('[data-static]')).toBeNull()
    expect(host.querySelectorAll('input')).toHaveLength(1)
  })

  test('carries typed text, focus and caret onto the control of the same name', async () => {
    typeInto(serve('<input type="search" name="q" />'), 'gopher', [2, 4])
    await mount(Field as IslandComponent)

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
      typeInto(serve(renderToStaticMarkup(<HeroSearchStatic />)), 'hacker', [6, 6])
      await mount(SearchIsland as IslandComponent, { variant: 'hero' })

      const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')
      expect(input?.value).toBe('hacker')
      expect(document.activeElement).toBe(input)
      expect(input?.selectionStart).toBe(6)
    })
  })
})

describe('restoreFormState', () => {
  test('leaves focus where the reader has since moved it', () => {
    typeInto(serve('<input name="q" />'), 'x', [1, 1])
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
    serve('<input name="q" value="served" />')
    const carried = captureFormState(host)
    expect(carried.values.size).toBe(0)
    expect(carried.focus).toBeNull()
  })
})
