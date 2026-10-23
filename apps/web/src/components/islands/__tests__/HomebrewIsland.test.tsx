/**
 * Homebrew on the SRD (ADR-061): on a chassis page, a "Show Homebrew" switch
 * that is off until a reader turns it on, remembered in this browser, and
 * lists that chassis's shared patterns while on; on `/homebrew/`, every one.
 */

import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SHOW_HOMEBREW_KEY } from '../../../lib/homebrew/homebrew'
import { HomebrewIsland } from '../HomebrewIsland'

const body = (id: string, name: string, chassisRef: string) => ({
  id,
  schemaVersion: 1,
  name,
  chassisRef,
  systems: [],
  modules: [],
  cargoLots: [],
  createdAt: '2026-10-22T00:00:00.000Z',
})
const ROWS = [
  { appId: 'pat-a', body: body('pat-a', 'Tow Rig', 'mule'), madeBy: 'Rosa', sharedAt: 2 },
  { appId: 'pat-b', body: body('pat-b', 'Hauler Plus', 'mule'), madeBy: 'Ash', sharedAt: 1 },
]

let fetchSpy: ReturnType<typeof spyOn> | undefined
function answer(response: () => Response) {
  const asked: string[] = []
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
    asked.push(url)
    return response()
  }) as typeof fetch)
  return asked
}

afterEach(() => {
  cleanup()
  fetchSpy?.mockRestore()
  localStorage.clear()
})

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('on a chassis page', () => {
  test('off by default, it fetches nothing; turned on, it lists the chassis’s homebrew', async () => {
    const asked = answer(() => new Response(JSON.stringify(ROWS)))
    render(<HomebrewIsland chassisRef="mule" />)
    await settle()
    expect(asked).toEqual([])
    expect(screen.getByText(/Not from the book/)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show Homebrew' }))
    })
    await settle()
    expect(asked).toEqual(['/homebrew/patterns.json?chassis=mule'])
    expect(localStorage.getItem(SHOW_HOMEBREW_KEY)).toBe('on')
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toEqual(['/build/p/pattern/pat-a', '/build/p/pattern/pat-b'])
    // The section's title, then each row's HOMEBREW stamp.
    expect(screen.getAllByText(/^homebrew$/i)).toHaveLength(3)
  })

  test('one "Show all" under it counts the book’s and the homebrew; a phone waits on the rest', async () => {
    localStorage.setItem(SHOW_HOMEBREW_KEY, 'on')
    answer(() => new Response(JSON.stringify(ROWS)))
    const { container } = render(<HomebrewIsland chassisRef="mule" bookPatterns={1} />)
    expect(screen.queryByRole('link', { name: /show all/i })).toBeNull()
    await settle()
    const more = screen.getByRole('link', { name: 'Show all 3 patterns' })
    expect(more.getAttribute('href')).toBe('#patterns')
    // The book's one shows, then the first homebrew; the second waits for "Show all".
    expect(container.querySelectorAll('.su-homebrew__more')).toHaveLength(1)
  })

  test('with no book patterns, "Show all" opens the Homebrew section', async () => {
    localStorage.setItem(SHOW_HOMEBREW_KEY, 'on')
    answer(() => new Response(JSON.stringify([...ROWS, { ...ROWS[0], appId: 'pat-c' }])))
    render(<HomebrewIsland chassisRef="mule" />)
    await settle()
    const more = screen.getByRole('link', { name: 'Show all 3 patterns' })
    expect(more.getAttribute('href')).toBe('#homebrew-patterns')
  })

  test('remembered on, it lists at once; none shared, it says so; turned off, it hides them', async () => {
    localStorage.setItem(SHOW_HOMEBREW_KEY, 'on')
    answer(() => new Response('[]'))
    render(<HomebrewIsland chassisRef="mule" />)
    await settle()
    expect(screen.getByText('No player has shared a pattern for this chassis yet.')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show Homebrew' }))
    })
    expect(localStorage.getItem(SHOW_HOMEBREW_KEY)).toBeNull()
    expect(screen.getByText(/Not from the book/)).toBeTruthy()
  })
})

describe('built-in homebrew', () => {
  test('a chassis’s Mech Monday patterns list first, credited by their chip', async () => {
    localStorage.setItem(SHOW_HOMEBREW_KEY, 'on')
    answer(() => new Response('[]'))
    render(<HomebrewIsland chassisRef="gatecrasher" bookPatterns={3} builtInPatterns={8} />)
    await settle()
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toContain('/chassis/gatecrasher/pattern/retiarius-terebro/')
    expect(screen.getByRole('link', { name: 'Show all 11 patterns' })).toBeTruthy()
    expect(screen.getByText('blk_ivy')).toBeTruthy()
    expect(screen.getAllByText(/^mech monday$/i)).toHaveLength(8)
    // Players' "none yet" is only for a chassis with nothing to list.
    expect(screen.queryByText('No player has shared a pattern for this chassis yet.')).toBeNull()
  })
})

describe('on the Homebrew page', () => {
  test('lists every one', async () => {
    const asked = answer(() => new Response(JSON.stringify(ROWS)))
    render(<HomebrewIsland />)
    await settle()
    expect(asked).toEqual(['/homebrew/patterns.json'])
    // Each pattern's head opens it (its loadout's parts link to their own pages).
    const links = [...document.querySelectorAll('a.su-pattern-rows__head')].map((a) =>
      a.getAttribute('href')
    )
    // The reference's built-in ones first (the Gatecrasher's Mech Monday eight), then the players'.
    expect(links).toHaveLength(10)
    expect(links[0]).toBe('/chassis/gatecrasher/pattern/cornerstone/')
    expect(links.slice(-2)).toEqual(['/build/p/pattern/pat-a', '/build/p/pattern/pat-b'])
  })

  test('a failed read says so', async () => {
    answer(() => new Response('', { status: 503 }))
    render(<HomebrewIsland />)
    await settle()
    expect(screen.getByText('Homebrew did not load. Try again later.')).toBeTruthy()
  })
})
