/**
 * `accountLink.link`, the sign-in's bridge: the Worker's link token finds the
 * account Convex Auth made, or makes one, and nothing else may call it.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { LINK_ISSUER, SESSION_ISSUER } from 'game-domain/authWire'
import { api } from '../../../convex/_generated/api'
import { makeUser } from '../fixtures'
import { testConvex } from '../harness'

const link = (t: ReturnType<typeof testConvex>, identity: Record<string, string>) =>
  t.withIdentity({ issuer: LINK_ISSUER, ...identity }).mutation(api.accountLink.link, {})

afterEach(() => {
  delete process.env.TEST_AUTH
})

describe('accountLink.link', () => {
  test('finds the account a Discord sign-in made before, and refreshes its profile', async () => {
    const t = testConvex()
    const { userId } = await makeUser(t, 'Rae', '8035')
    const linked = await link(t, {
      subject: 'discord:8035',
      name: 'Rae Voss',
      pictureUrl: 'https://cdn.example/a.png',
    })
    expect(linked).toBe(userId)
    const user = await t.run((ctx) => ctx.db.get(userId))
    expect(user).toMatchObject({ name: 'Rae Voss', image: 'https://cdn.example/a.png' })
  })

  test('makes the account on a first sign-in, once', async () => {
    const t = testConvex()
    const first = await link(t, { subject: 'discord:42', name: 'New' })
    expect(await link(t, { subject: 'discord:42', name: 'New' })).toBe(first)
    const accounts = await t.run((ctx) => ctx.db.query('authAccounts').collect())
    expect(accounts).toEqual([
      expect.objectContaining({ userId: first, provider: 'discord', providerAccountId: '42' }),
    ])
  })

  test('takes no session token and no stranger', async () => {
    const t = testConvex()
    await expect(
      t
        .withIdentity({ issuer: SESSION_ISSUER, subject: 'discord:42' })
        .mutation(api.accountLink.link, {})
    ).rejects.toThrow('link token')
    await expect(t.mutation(api.accountLink.link, {})).rejects.toThrow('link token')
  })

  test('links a test account only where TEST_AUTH is on', async () => {
    const t = testConvex()
    await expect(link(t, { subject: 'test:a@example.com' })).rejects.toThrow('not an account')
    process.env.TEST_AUTH = 'true'
    const userId = await link(t, { subject: 'test:a@example.com', email: 'a@example.com' })
    const account = await t.run((ctx) =>
      ctx.db
        .query('authAccounts')
        .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
        .unique()
    )
    expect(account).toMatchObject({ provider: 'password', providerAccountId: 'a@example.com' })
  })
})
