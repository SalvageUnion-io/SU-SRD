import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { EMAIL_INVITES_PER_DAY } from '../../convex/invites'
import { composeInviteLetter } from '../../convex/model/inviteLetter'
import { maskEmail } from '../../convex/model/invites'
import { testConvex } from './harness'

/**
 * Email invites (ADR-038 §4–6).
 *
 * Defended here: the invite and its send are one act; the app cannot be used
 * to mail strangers (a daily limit, one waiting invite per address); the
 * address is forgotten the moment the invite stops being live; the key is
 * sent where it belongs and nowhere else; and the letter says nothing the
 * landing page would not.
 *
 * `fetch` is replaced for the whole file with a recorder, so nothing here can
 * reach Resend, whatever the environment holds.
 */

type Ctx = ReturnType<typeof testConvex>
type FetchCall = { url: string; init: RequestInit }

const realFetch = globalThis.fetch
const realKey = process.env.RESEND_API_KEY
let fetchCalls: FetchCall[] = []
let fetchStatus = 200

beforeAll(() => {
  globalThis.fetch = ((url: string, init: RequestInit) => {
    fetchCalls.push({ url, init })
    return Promise.resolve(new Response('{"id":"email-1"}', { status: fetchStatus }))
  }) as unknown as typeof fetch
})

afterEach(() => {
  fetchCalls = []
  fetchStatus = 200
  if (realKey === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = realKey
})

afterAll(() => {
  globalThis.fetch = realFetch
})

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run((ctx) => ctx.db.insert('users', { name, displayName: name }))
  return { userId, as: t.withIdentity({ subject: userId }) }
}

async function seedGame(t: Ctx) {
  const vex = await makeUser(t, 'Vex')
  const gameId = await vex.as.mutation(api.games.create, { name: 'Tenacity' })
  return { vex, gameId }
}

async function inviteRow(t: Ctx, code: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query('invites')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()
  )
  if (row === null) throw new Error(`no invite ${code}`)
  return row
}

describe('invites.sendEmail', () => {
  test('mints a single-use invite addressed to the email, and schedules the send with it', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedGame(t)

    const { code } = await vex.as.mutation(api.invites.sendEmail, {
      gameId,
      email: '  Sam@Example.com ',
    })

    const row = await inviteRow(t, code)
    expect(row.target).toEqual({
      kind: 'email',
      address: 'sam@example.com',
      masked: 's•••@example.com',
    })
    expect(row.usesRemaining).toBe(1)

    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(scheduled.map((job) => job.name)).toEqual(['inviteEmail:send'])
    expect(scheduled[0]?.args[0]).toMatchObject({ inviteId: row._id })
  })

  test('only the Organizer can send one', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedGame(t)
    const pat = await makeUser(t, 'Pat')
    const code = await vex.as.mutation(api.invites.create, { gameId })
    await pat.as.mutation(api.invites.redeem, { code })

    await expect(
      pat.as.mutation(api.invites.sendEmail, { gameId, email: 'sam@example.com' })
    ).rejects.toThrow()
  })

  test('refuses something that is not an address', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedGame(t)
    for (const email of ['sam', 'sam@', '@example.com', 'sam @example.com', 'a@b']) {
      await expect(vex.as.mutation(api.invites.sendEmail, { gameId, email })).rejects.toThrow(
        /does not look like an email/
      )
    }
  })

  test('will not send a second invite while one to that address is waiting', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedGame(t)
    const first = await vex.as.mutation(api.invites.sendEmail, { gameId, email: 'sam@example.com' })

    await expect(
      vex.as.mutation(api.invites.sendEmail, { gameId, email: 'SAM@example.com' })
    ).rejects.toThrow(/already waiting/)

    // Revoked, the door is open again.
    const row = await inviteRow(t, first.code)
    await vex.as.mutation(api.invites.revoke, { inviteId: row._id })
    await vex.as.mutation(api.invites.sendEmail, { gameId, email: 'sam@example.com' })
  })

  test('stops at the daily limit, across all of an Organizer’s Games', async () => {
    const t = testConvex()
    const { vex, gameId } = await seedGame(t)
    const other = await vex.as.mutation(api.games.create, { name: 'Second' })

    for (let i = 0; i < EMAIL_INVITES_PER_DAY; i += 1) {
      await vex.as.mutation(api.invites.sendEmail, {
        gameId: i % 2 === 0 ? gameId : other,
        email: `player${i}@example.com`,
      })
    }
    await expect(
      vex.as.mutation(api.invites.sendEmail, { gameId, email: 'one-more@example.com' })
    ).rejects.toThrow(/invites a day/)
    // Codes are not emails and are not limited by this.
    await vex.as.mutation(api.invites.create, { gameId })
  })
})

describe('the address is kept only while the invite is live', () => {
  async function sent(t: Ctx) {
    const { vex, gameId } = await seedGame(t)
    const { code } = await vex.as.mutation(api.invites.sendEmail, {
      gameId,
      email: 'sam@example.com',
    })
    return { vex, gameId, code }
  }

  test('redeeming forgets it', async () => {
    const t = testConvex()
    const { code } = await sent(t)
    const sam = await makeUser(t, 'Sam')
    await sam.as.mutation(api.invites.redeem, { code })

    expect((await inviteRow(t, code)).target).toEqual({ kind: 'email', masked: 's•••@example.com' })
  })

  test('declining forgets it', async () => {
    const t = testConvex()
    const { code } = await sent(t)
    const sam = await makeUser(t, 'Sam')
    await sam.as.mutation(api.invites.decline, { code })

    expect((await inviteRow(t, code)).target).toEqual({ kind: 'email', masked: 's•••@example.com' })
  })

  test('revoking forgets it', async () => {
    const t = testConvex()
    const { vex, code } = await sent(t)
    await vex.as.mutation(api.invites.revoke, { inviteId: (await inviteRow(t, code))._id })

    expect((await inviteRow(t, code)).target).toEqual({ kind: 'email', masked: 's•••@example.com' })
  })

  test('the daily sweep forgets an expired one, and leaves a live one alone', async () => {
    const t = testConvex()
    const { vex, gameId, code } = await sent(t)
    const live = await vex.as.mutation(api.invites.sendEmail, { gameId, email: 'kit@example.com' })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('invites')
        .withIndex('by_code', (q) => q.eq('code', code))
        .unique()
      if (row !== null) await ctx.db.patch(row._id, { expiresAt: Date.now() - 1000 })
    })

    expect(await t.mutation(internal.inviteEmail.forgetExpiredAddresses, {})).toBe(1)
    expect((await inviteRow(t, code)).target).toEqual({ kind: 'email', masked: 's•••@example.com' })
    expect((await inviteRow(t, live.code)).target).toMatchObject({ address: 'kit@example.com' })
  })

  test('the Organizer’s list shows only the mask, even while the address is kept', async () => {
    const t = testConvex()
    const { vex, gameId } = await sent(t)
    const [row] = await vex.as.query(api.invites.list, { gameId })
    expect(row?.target).toEqual({ kind: 'email', masked: 's•••@example.com' })
    expect(JSON.stringify(row)).not.toContain('sam@example.com')
  })
})

describe('inviteEmail.send', () => {
  async function queued(t: Ctx) {
    const { vex, gameId } = await seedGame(t)
    const { code } = await vex.as.mutation(api.invites.sendEmail, {
      gameId,
      email: 'sam@example.com',
      role: 'mediator',
    })
    const row = await inviteRow(t, code)
    return { vex, gameId, code, inviteId: row._id as Id<'invites'> }
  }

  test('posts the letter to Resend with the key, and records it sent', async () => {
    const t = testConvex()
    const { code, inviteId } = await queued(t)
    process.env.RESEND_API_KEY = 're_test_key'

    await t.action(internal.inviteEmail.send, { inviteId, attempt: '1' })

    expect(fetchCalls).toHaveLength(1)
    const call = fetchCalls[0]
    expect(call?.url).toBe('https://api.resend.com/emails')
    const headers = call?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer re_test_key')
    expect(headers['Idempotency-Key']).toBe(`invite-${inviteId}-1`)
    const body = JSON.parse(String(call?.init.body)) as {
      to: string[]
      subject: string
      text: string
    }
    expect(body.to).toEqual(['sam@example.com'])
    expect(body.subject).toBe('Vex invited you to Tenacity on In The Union Now')
    expect(body.text).toContain(`/join/${code}`)
    // The key goes in the header and nowhere else.
    expect(String(call?.init.body)).not.toContain('re_test_key')

    expect((await inviteRow(t, code)).delivery?.state).toBe('sent')
  })

  test('a refusal from Resend is recorded for the Organizer', async () => {
    const t = testConvex()
    const { code, inviteId } = await queued(t)
    process.env.RESEND_API_KEY = 're_test_key'
    fetchStatus = 422

    await t.action(internal.inviteEmail.send, { inviteId, attempt: '1' })

    expect((await inviteRow(t, code)).delivery).toMatchObject({
      state: 'failed',
      detail: 'the email service refused it (422)',
    })
  })

  test('with no key it sends nothing and says email is not set up', async () => {
    const t = testConvex()
    const { code, inviteId } = await queued(t)
    delete process.env.RESEND_API_KEY

    await t.action(internal.inviteEmail.send, { inviteId, attempt: '1' })

    expect(fetchCalls).toHaveLength(0)
    expect((await inviteRow(t, code)).delivery).toMatchObject({
      state: 'failed',
      detail: 'email is not set up on this server',
    })
  })

  test('an invite revoked before the send goes out is not sent', async () => {
    const t = testConvex()
    const { vex, inviteId } = await queued(t)
    process.env.RESEND_API_KEY = 're_test_key'
    await vex.as.mutation(api.invites.revoke, { inviteId })

    await t.action(internal.inviteEmail.send, { inviteId, attempt: '1' })

    expect(fetchCalls).toHaveLength(0)
  })
})

describe('the letter', () => {
  const NOW = 1_700_000_000_000
  const FACTS = {
    code: 'A1B2C3D4',
    gameName: 'Tenacity',
    invitedBy: 'Vex',
    role: 'player' as const,
    grantCount: 0,
    expiresAt: NOW + 7 * 24 * 60 * 60 * 1000,
    requiresApproval: false,
  }

  test('says who, what, how to join and how long — and why you got it', () => {
    const letter = composeInviteLetter(FACTS, 'https://intheunionnow.com/', NOW)
    expect(letter.text).toContain('Vex invited you to Tenacity on In The Union Now.')
    expect(letter.text).toContain('https://intheunionnow.com/join/A1B2C3D4')
    expect(letter.text).toContain('Or join with the code A1B2C3D4')
    expect(letter.text).toContain('expires in 7 days')
    expect(letter.text).toContain('typed your address')
    expect(letter.text).toContain('kept only until the invite is used')
  })

  test('mentions the seat, what is waiting, and the approval when there is one', () => {
    const letter = composeInviteLetter(
      { ...FACTS, role: 'mediator', grantCount: 2, requiresApproval: true },
      'https://x',
      NOW
    )
    expect(letter.text).toContain('as its Mediator')
    expect(letter.text).toContain('2 characters are waiting for you.')
    expect(letter.text).toContain('Vex will let you in before you can see the table.')
  })

  test('an Organizer-chosen name cannot inject markup or a second header line', () => {
    const letter = composeInviteLetter(
      { ...FACTS, gameName: '<img src=x>\r\nBcc: someone', invitedBy: 'Vex & co' },
      'https://x',
      NOW
    )
    expect(letter.html).not.toContain('<img')
    expect(letter.html).toContain('&lt;img src=x&gt;')
    expect(letter.html).toContain('Vex &amp; co')
    expect(letter.subject).not.toMatch(/[\r\n]/)
  })

  test('carries no images and no link but the join page', () => {
    const letter = composeInviteLetter(FACTS, 'https://intheunionnow.com', NOW)
    expect(letter.html).not.toContain('<img')
    expect(letter.html.match(/href=/g)).toHaveLength(1)
  })

  test('masks an address to its first character and domain', () => {
    expect(maskEmail('sam@example.com')).toBe('s•••@example.com')
    expect(maskEmail('not-an-address')).toBe('•••')
  })
})
