/**
 * Homebrew on the SRD (ADR-058): on a chassis page, a "Show Homebrew" switch
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
    expect(screen.getAllByText(/^homebrew$/i)).toHaveLength(2)
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

describe('on the Homebrew page', () => {
  test('lists every one', async () => {
    const asked = answer(() => new Response(JSON.stringify(ROWS)))
    render(<HomebrewIsland />)
    await settle()
    expect(asked).toEqual(['/homebrew/patterns.json'])
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  test('a failed read says so', async () => {
    answer(() => new Response('', { status: 503 }))
    render(<HomebrewIsland />)
    await settle()
    expect(screen.getByText('Homebrew did not load. Try again later.')).toBeTruthy()
  })
})
