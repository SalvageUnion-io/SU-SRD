import { afterEach, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'

/**
 * `useGamePresence` — who the Game's room says is here, off the socket the
 * replica holds open (play.md §7). A seat sits its player at the table while
 * mounted (one seat however many screens), and sits again when the socket
 * reopens; a watcher only hears.
 */

import {
  closeRooms,
  drop,
  hear,
  openRooms,
  reopen,
  seatActs,
} from '../../replica/__tests__/fakeRooms'
import { useGamePresence } from '../useGamePresence'

afterEach(() => closeRooms())

const seen: Record<string, ReadonlySet<string> | null> = {}

type Probe = { name: string; gameId: string | null; role: 'seat' | 'watch' }

function Probe({ name, gameId, role }: Probe) {
  seen[name] = useGamePresence(gameId, role)
  return null
}

const mount = (probes: Probe[]) =>
  render(
    <>
      {probes.map((p) => (
        <Probe key={p.name} {...p} />
      ))}
    </>
  )

const seats = () => seatActs.map((a) => a.args.here)

describe('useGamePresence', () => {
  test('hears who the room says is here, and forgets it when the socket drops', () => {
    openRooms('g1')
    mount([
      { name: 'a', gameId: 'g1', role: 'watch' },
      { name: 'none', gameId: null, role: 'watch' },
    ])
    expect(seen.a).toBeNull()
    hear('g1', { type: 'presence', here: ['u1', 'u2'] })
    expect([...(seen.a ?? [])]).toEqual(['u1', 'u2'])
    expect(seen.none).toBeNull()
    drop('g1')
    expect(seen.a).toBeNull()
    // A watcher never sits.
    expect(seats()).toEqual([])
  })

  test('screens of one Game share one seat, stood when the last unmounts', () => {
    openRooms('g1')
    const first = mount([{ name: 's1', gameId: 'g1', role: 'seat' }])
    const second = mount([{ name: 's2', gameId: 'g1', role: 'seat' }])
    expect(seats()).toEqual([true])
    first.unmount()
    expect(seats()).toEqual([true])
    act(() => second.unmount())
    expect(seats()).toEqual([true, false])
  })

  test('a seat taken before the socket opens, or across a reconnect, is told when it opens', () => {
    openRooms('g1')
    drop('g1')
    const view = mount([{ name: 's', gameId: 'g1', role: 'seat' }])
    expect(seats()).toEqual([])
    reopen('g1')
    expect(seats()).toEqual([true])
    reopen('g1')
    expect(seats()).toEqual([true, true])
    view.unmount()
  })
})
