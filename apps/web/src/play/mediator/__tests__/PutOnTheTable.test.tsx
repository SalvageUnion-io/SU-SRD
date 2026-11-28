/**
 * Put on the table (ADR-068 §4-5): the Mediator's sheet sends what it shows,
 * Clear, Hold and a roll asked of a seat; the Docket lists what the table
 * waits on and takes an ask back.
 */

import { afterAll, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const realTable = { ...(await import('../../../replica/useTable')) }
const sent: { name: string; args: unknown }[] = []
mock.module('../../../replica/useTable', () => ({
  ...realTable,
  useTableAct: (name: string) => async (args: unknown) => {
    sent.push({ name, args })
  },
}))
afterAll(() => {
  mock.module('../../../replica/useTable', () => realTable)
})

const { PutOnTheTable } = await import('../PutOnTheTable')
const { PlayMediatorDocket } = await import('../PlayMediatorDocket')
type Mediator = import('../usePlayMediator').PlayMediator

function mediator(over: Record<string, unknown> = {}): Mediator {
  return {
    gameId: 'g1',
    canWrite: true,
    scene: { conditions: [], hours: 0 },
    npcs: [{ id: 'n1', name: 'Raider 2', down: false, group: null }],
    seats: [
      { pilotId: 'p1', name: 'Bonesaw' },
      { pilotId: 'p2', name: 'Judge' },
    ],
    sent: [],
    crew: null,
    ...over,
  } as unknown as Mediator
}

async function press(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('the Put on the table sheet', () => {
  test('shows an NPC and a table, asks a seat for a roll, and holds the table', async () => {
    sent.length = 0
    await act(async () => {
      render(<PutOnTheTable mediator={mediator()} />)
    })
    expect(screen.getByText('Nothing is on the table.')).toBeTruthy()
    await press('Show Raider 2')
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'A seat' }), {
        target: { value: 'p2' },
      })
    })
    await press(/^Ask Judge to roll /)
    await press('Hold the table')
    expect(sent.map((s) => s.name)).toEqual(['scenes.putOnTable', 'scenes.askRoll', 'scenes.hold'])
    expect(sent[0]?.args).toEqual({ put: { kind: 'npc', npcId: 'n1' } })
    expect(sent[1]?.args).toMatchObject({ pilotId: 'p2' })
    expect(sent[2]?.args).toEqual({ hold: true })
    cleanup()
  })

  test('what is on the table is named, with Clear; no NPC and no seat say so', async () => {
    sent.length = 0
    await act(async () => {
      render(
        <PutOnTheTable
          mediator={mediator({
            npcs: [],
            seats: [],
            scene: { conditions: [], hours: 0, onTable: { kind: 'table', name: 'Core Mechanic' } },
          })}
        />
      )
    })
    expect(screen.getByText('On the table: Core Mechanic')).toBeTruthy()
    expect(screen.getByText('No NPC on the tray.')).toBeTruthy()
    expect(screen.getByText('No seat at the table yet.')).toBeTruthy()
    await press('Clear')
    expect(sent).toEqual([{ name: 'scenes.putOnTable', args: { put: null } }])
    cleanup()
  })
})

describe('the Docket', () => {
  test('lists an ask with Withdraw and an NPC to act with Open; nothing waiting takes no room', async () => {
    sent.length = 0
    const opened: string[] = []
    const asked = mediator({
      scene: { conditions: [], hours: 0, asks: [{ pilotId: 'p1', table: 'Core Mechanic' }] },
    })
    await act(async () => {
      render(<PlayMediatorDocket mediator={asked} acted={[]} onOpen={(id) => opened.push(id)} />)
    })
    expect(screen.getByText('Bonesaw · Core Mechanic')).toBeTruthy()
    await press('Open Raider 2')
    await press('Withdraw the roll asked of Bonesaw')
    expect(opened).toEqual(['n1'])
    expect(sent).toEqual([{ name: 'scenes.askRoll', args: { pilotId: 'p1', table: null } }])
    cleanup()
    const { container } = render(
      <PlayMediatorDocket mediator={mediator({ npcs: [] })} acted={null} onOpen={() => {}} />
    )
    expect(container.textContent).toBe('')
    cleanup()
  })
})
