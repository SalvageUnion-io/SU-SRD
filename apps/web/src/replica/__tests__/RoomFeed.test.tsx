import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import { accountSocketPath, gameSocketPath } from '../../rooms/routes'

/**
 * The replica's feed: signed in, a socket on the account room and one on each
 * Game the player is in (`games.listMine`); a Game they leave closes its
 * socket, and unmounting closes them all.
 */

let person: string | null = 'u1'
const opened: string[] = []
const closed: string[] = []

// Captured before anything is mocked: the stand-in keeps every other export.
const realRoomSocket = { ...(await import('../roomSocket')) }
const serverMocks = await installServerMocks({
  authReact: { useMyPerson: () => person },
  also: {
    '../../replica/roomSocket': () => ({
      ...realRoomSocket,
      openRoom: (path: string) => {
        opened.push(path)
        return () => closed.push(path)
      },
    }),
  },
})
const { RoomFeed } = await import('../RoomFeed')

afterAll(() => {
  serverMocks.restore()
})

beforeEach(() => {
  person = 'u1'
  opened.length = 0
  closed.length = 0
})

const games = (...ids: string[]) =>
  setQueryAnswers({ 'games.listMine': ids.map((id) => ({ _id: id, name: id })) })

describe('RoomFeed', () => {
  test('signed in, it opens the account room and each Game’s', () => {
    games('g1', 'g2')
    const { unmount } = render(<RoomFeed />)
    expect(opened).toEqual([gameSocketPath('g1'), gameSocketPath('g2'), accountSocketPath()])
    unmount()
    expect([...closed].sort()).toEqual([...opened].sort())
  })

  test('a Game the player leaves closes its room', () => {
    games('g1', 'g2')
    const { rerender, unmount } = render(<RoomFeed />)
    games('g2')
    act(() => rerender(<RoomFeed />))
    expect(closed).toEqual([gameSocketPath('g1')])
    unmount()
  })

  test('signed out, nothing opens', () => {
    person = null
    games('g1')
    const { container, unmount } = render(<RoomFeed />)
    expect(opened).toEqual([])
    expect(container.textContent).toBe('')
    unmount()
  })
})
