/**
 * /encounters/add?from=<schema>:<slug> (ADR-067 §3): a Reference denizen is
 * fielded in one of the reader's encounters, or in a new one, and the reader
 * lands on that encounter. Rendered without a router, so `useGo` falls back
 * to `location.assign`.
 */

import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Encounter } from 'game-domain/schemas/encounter'
import { ENCOUNTER_MAX_OPPOSITION } from 'game-domain/schemas/encounter'
import { installServerMocks } from '../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'

const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { ToasterMount, toast } = await import('../../../components/index')
const { SyncContext } = await import('../../../replica/syncContext')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { useEncounters } = await import('../../../replica/collections')
const { AddToEncounterPage } = await import('../AddToEncounterPage')

withSignedInBackend()

const NOW = '2026-10-22T00:00:00.000Z'
const RAIDER = {
  id: 'o1',
  refSchema: 'npcs' as const,
  refSlug: 'raider',
  refName: 'Raider',
  name: 'Raider',
  maxHp: 3,
  statKind: 'hp' as const,
}

function encounter(id: string, name: string, opposition: Encounter['opposition'] = []): Encounter {
  return {
    id,
    schemaVersion: 1,
    name,
    opposition,
    tables: [],
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
  }
}

let assigned: string[] = []
let assignSpy: ReturnType<typeof spyOn> | null = null

beforeEach(() => {
  assigned = []
  assignSpy = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
    assigned.push(String(to))
  })
  toast.dismiss()
  resetStores()
  useEncounters.setState({ encounters: [], hydrated: true } as never)
})
afterEach(() => {
  assignSpy?.mockRestore()
  toast.dismiss()
})

async function renderPage(schema: string, slug: string, canWrite = true) {
  await act(async () => {
    render(
      <SyncContext.Provider
        value={{ status: canWrite ? 'live' : 'signedOut', canWrite, outdated: false }}
      >
        <ToasterMount />
        <AddToEncounterPage schema={schema} slug={slug} />
      </SyncContext.Provider>
    )
  })
}

async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 40 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

const stored = (id: string) => useEncounters.getState().encounters.find((e) => e.id === id)

describe('adding a Reference denizen to an encounter', () => {
  test('a page that is not a denizen has nothing to add, and leads back to the Kit', async () => {
    await renderPage('chassis', 'mule')
    expect(screen.getByText('Nothing to add')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Mediator’s Kit/ }).getAttribute('href')).toBe(
      '/games/#mediators-kit'
    )
  })

  test('a denizen the reference does not hold has nothing to add either', async () => {
    await renderPage('npcs', 'no-such-npc')
    expect(screen.getByText('Nothing to add')).toBeTruthy()
  })

  test('a reader who cannot write is told to sign in, and offered no encounter', async () => {
    useEncounters.setState({ encounters: [encounter('e1', 'Ambush')], hydrated: true } as never)
    await renderPage('npcs', 'raider', false)
    expect(
      screen.getByRole('heading', { level: 1, name: /Add Raider to an encounter/ })
    ).toBeTruthy()
    expect(screen.getByText('Sign in to prepare encounters.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('with no encounters yet, the one way is a new encounter, which it then opens', async () => {
    await renderPage('npcs', 'raider')
    expect(screen.getByText(/You have no encounters yet/)).toBeTruthy()
    await click(screen.getByRole('button', { name: '+ In a new encounter' }))
    await settle(() => assigned.length > 0 && screen.queryByText(/^Added Raider/) !== null)
    const [made] = useEncounters.getState().encounters
    expect(made?.opposition.map((o) => o.refSlug)).toEqual(['raider'])
    expect(assigned).toEqual([`/encounters/${made?.id}`])
    expect(screen.getByText(`Added Raider to ${made?.name}.`)).toBeTruthy()
  })

  test('picking an encounter fields the denizen there and opens it', async () => {
    useEncounters.setState({
      encounters: [encounter('e1', 'Ambush', [RAIDER]), encounter('e2', 'Toll Gate')],
      hydrated: true,
    } as never)
    await renderPage('npcs', 'raider')
    expect(screen.getByText(/Pick the encounter it joins/)).toBeTruthy()
    await click(screen.getByRole('button', { name: '+ Add Raider: Ambush' }))
    await settle(() => assigned.length > 0 && screen.queryByText(/^Added Raider/) !== null)
    expect(stored('e1')?.opposition).toHaveLength(2)
    expect(stored('e2')?.opposition).toHaveLength(0)
    expect(assigned).toEqual(['/encounters/e1'])
    expect(screen.getByText('Added Raider to Ambush.')).toBeTruthy()
  })

  test('a full encounter says so and takes no more', async () => {
    const full = Array.from({ length: ENCOUNTER_MAX_OPPOSITION }, (_, i) => ({
      ...RAIDER,
      id: `o${i}`,
    }))
    useEncounters.setState({
      encounters: [encounter('e1', 'Ambush', full)],
      hydrated: true,
    } as never)
    await renderPage('npcs', 'raider')
    const add = screen.getByRole('button', { name: '+ Add Raider: Ambush' })
    expect(add.textContent).toBe('Full')
    expect(add).toHaveProperty('disabled', true)
  })
})
