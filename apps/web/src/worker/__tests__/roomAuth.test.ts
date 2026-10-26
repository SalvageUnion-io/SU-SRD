import { describe, expect, test } from 'bun:test'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { roomMember, socketToken } from '../roomAuth'

// happy-dom's Request drops `Sec-` headers, as a browser's must; the Worker's never does.
const { Request } = NATIVE_FETCH_GLOBALS

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
const TOKEN = `${b64({ alg: 'RS256' })}.${b64({ sub: 'user1|session9' })}.sig`

function socket(protocol: string | null): Request {
  const headers: Record<string, string> = { upgrade: 'websocket' }
  if (protocol !== null) headers['sec-websocket-protocol'] = protocol
  return new Request('https://salvageunion.io/__rooms/games/g1/socket', { headers })
}

const convex =
  (value: unknown, ok = true) =>
  async () =>
    new Response(JSON.stringify({ status: 'success', value }), { status: ok ? 200 : 500 })

describe('socketToken', () => {
  test('is the entry after the room protocol', () => {
    expect(socketToken(socket(`su-room, ${TOKEN}`))).toBe(TOKEN)
    expect(socketToken(socket(`other, ${TOKEN}`))).toBeNull()
    expect(socketToken(socket(null))).toBeNull()
  })
})

describe('roomMember', () => {
  const env = { CONVEX_URL: 'https://convex.example' }
  const nobody = async () => null

  test('the signed-in member comes first, without asking Convex', async () => {
    const fetchImpl = async () => {
      throw new Error('Convex was asked')
    }
    const signedIn = async (_req: Request, gameId: string) => (gameId === 'g1' ? 'd-1' : null)
    expect(await roomMember(socket('su-room'), env, 'g1', signedIn, fetchImpl)).toBe('d-1')
  })

  test("a member is the token's user", async () => {
    let asked: RequestInit | undefined
    const fetchImpl = async (_url: string, init: RequestInit) => {
      asked = init
      return convex({ _id: 'g1' })()
    }
    expect(await roomMember(socket(`su-room, ${TOKEN}`), env, 'g1', nobody, fetchImpl)).toBe(
      'user1'
    )
    expect(new Headers(asked?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(String(asked?.body))).toMatchObject({
      path: 'games:get',
      args: { gameId: 'g1' },
    })
  })

  test('anyone else, or an unreachable Convex, is nobody', async () => {
    const req = socket(`su-room, ${TOKEN}`)
    expect(await roomMember(req, env, 'g1', nobody, convex(null))).toBeNull()
    expect(await roomMember(req, env, 'g1', nobody, convex({ _id: 'g1' }, false))).toBeNull()
    expect(await roomMember(req, {}, 'g1', nobody, convex({ _id: 'g1' }))).toBeNull()
    expect(
      await roomMember(socket('su-room, junk'), env, 'g1', nobody, convex({ _id: 'g1' }))
    ).toBeNull()
  })
})
