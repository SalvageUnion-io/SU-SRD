import { describe, expect, it } from 'bun:test'
import { Responses } from '@discord/embedded-app-sdk'

/**
 * The Embedded App SDK pins zod 3, which carries an advisory
 * (GHSA-mrhx-c7xc-m3w5); the root `package.json` overrides it to zod 4.
 * These are the replies the Activity's sign-in and table read: each still
 * parses on the overridden zod.
 */

const parse = (cmd: string, data: unknown) =>
  Responses.parseResponsePayload({ cmd, evt: null, nonce: 'n', data } as never)

describe('the SDK on zod 4', () => {
  it('parses an authorize reply', () => {
    expect(parse('AUTHORIZE', { code: 'abc' }).data).toEqual({ code: 'abc' })
  })

  it('parses an authenticate reply', () => {
    const reply = parse('AUTHENTICATE', {
      access_token: 't',
      user: { id: '1', username: 'rae', discriminator: '0', avatar: null, public_flags: 0 },
      scopes: ['identify'],
      expires: '2026-12-01T00:00:00Z',
      application: { id: '1', name: 'SalvageUnion.io', description: '', icon: null },
    })
    expect((reply.data as { user: { username: string } }).user.username).toBe('rae')
  })

  it("parses the instance's participants", () => {
    const reply = parse('GET_ACTIVITY_INSTANCE_CONNECTED_PARTICIPANTS', {
      participants: [
        { id: '1', username: 'rae', discriminator: '0', bot: false, flags: 0, global_name: 'Rae' },
      ],
    })
    expect((reply.data as { participants: unknown[] }).participants).toHaveLength(1)
  })
})
