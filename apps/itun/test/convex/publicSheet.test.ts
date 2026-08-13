import { describe, expect, test } from 'bun:test'
import { api } from '../../convex/_generated/api'
import { testConvex } from './harness'

/**
 * Public, read-only sheets (ADR-032).
 *
 * This is the ONE deliberately unauthenticated read of player data in the whole
 * Convex surface, so these tests are mostly about what it refuses. ADR-030 §5
 * says visibility begins at membership; the exception is narrow, opt-in, and
 * has to stay that way.
 */

type Ctx = ReturnType<typeof testConvex>

async function makeUser(t: Ctx, name: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert('users', { name, displayName: name }))
  return { userId, as: t.withIdentity({ subject: userId }) }
}

/** A pilot on its owner's shelf, addressed by app id, private by default. */
async function seedPilot(t: Ctx, ownerId: string, appId = 'app-1') {
  return await t.run(async (ctx) =>
    ctx.db.insert('pilots', {
      gameId: null,
      ownerId: ownerId as never,
      appId,
      body: {
        id: appId,
        schemaVersion: 1,
        name: 'Kestrel Vance',
        callsign: 'Vex',
        classRef: 'salvager',
        abilities: [],
        equipment: [],
        motto: '',
        keepsake: '',
        appearance: '',
        background: '',
        conditions: [],
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      updatedAt: Date.now(),
    })
  )
}

describe('a sheet is private until its owner says otherwise', () => {
  test('an unpublished sheet reads as nothing at all', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await seedPilot(t, owner.userId)

    // Unauthenticated: no `withIdentity`. This is the whole point of the
    // surface, and it must still refuse.
    const result = await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'app-1' })
    expect(result).toBeNull()
  })

  test('an entity that does not exist reads the same as a private one', async () => {
    // Distinguishing them would confirm that a given entity exists, which is
    // itself a disclosure.
    const t = testConvex()
    const result = await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'nope' })
    expect(result).toBeNull()
  })

  test('publishing makes it readable with no account', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await seedPilot(t, owner.userId)

    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'app-1',
      isPublic: true,
    })

    const result = await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'app-1' })
    expect(result).not.toBeNull()
    expect(result).toMatchObject({ kind: 'pilot' })
    // The whole body travels, which is the point — the client parses it with
    // the same Zod schemas the sheet renders from.
    const body = result === null ? null : (result.body as { callsign: string })
    expect(body?.callsign).toBe('Vex')
  })

  test('unpublishing takes effect immediately', async () => {
    // There is one URL per entity and it is derived, not minted, so there is
    // no set of outstanding links to chase — this is the whole revocation
    // story and it has to actually work.
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await seedPilot(t, owner.userId)

    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'app-1',
      isPublic: true,
    })
    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'app-1',
      isPublic: false,
    })

    expect(await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'app-1' })).toBeNull()
  })
})

describe('only the owner may publish', () => {
  test('a stranger cannot publish somebody else’s pilot', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    const stranger = await makeUser(t, 'Stranger')
    await seedPilot(t, owner.userId)

    await expect(
      stranger.as.mutation(api.publicSheet.setPublic, {
        kind: 'pilot',
        appId: 'app-1',
        isPublic: true,
      })
    ).rejects.toThrow()
  })

  test('an anonymous caller cannot publish anything', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await seedPilot(t, owner.userId)

    await expect(
      t.mutation(api.publicSheet.setPublic, { kind: 'pilot', appId: 'app-1', isPublic: true })
    ).rejects.toThrow()
  })

  test('an unclaimed entity cannot be published by anyone', async () => {
    // Making a character world-readable is the owner's call, and an unclaimed
    // entity has no owner to make it.
    const t = testConvex()
    const someone = await makeUser(t, 'Someone')
    await t.run(async (ctx) =>
      ctx.db.insert('pilots', {
        gameId: null,
        ownerId: null,
        appId: 'orphan',
        body: { callsign: 'Nobody' },
        updatedAt: Date.now(),
      })
    )

    await expect(
      someone.as.mutation(api.publicSheet.setPublic, {
        kind: 'pilot',
        appId: 'orphan',
        isPublic: true,
      })
    ).rejects.toThrow()
  })
})

describe('the surface cannot be pointed at the Mediator’s tray', () => {
  test('there is no kind that reaches encounterNpcs', async () => {
    const t = testConvex()
    await t.run(async (ctx) =>
      ctx.db.insert('games', { name: 'Tenacity' }).then(async (gameId) => {
        await ctx.db.insert('encounterNpcs', { gameId, body: { name: 'Ambush' } })
      })
    )

    // The kind union is the whole surface: pilot, mech, crawler. There is no
    // argument that selects the one table ADR-030 §5 says must stay hidden.
    await expect(
      // @ts-expect-error — proving the type union is the enforcement, not a
      // runtime check that could be bypassed by a crafted argument.
      t.query(api.publicSheet.get, { kind: 'encounterNpc', appId: 'x' })
    ).rejects.toThrow()
  })
})

describe('a body that cannot be rendered is refused at publish time', () => {
  test('publishing an unparseable body fails for the owner, not the reader', async () => {
    // Better to fail where the owner is standing than on a page they have
    // already handed to somebody.
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await t.run(async (ctx) =>
      ctx.db.insert('pilots', {
        gameId: null,
        ownerId: owner.userId,
        appId: 'broken',
        body: { nothing: 'useful' },
        updatedAt: Date.now(),
      })
    )

    // The MESSAGE matters, not just the throw. `parseBody` throws a plain
    // Error, which Convex redacts to "Server Error" before the client sees it,
    // so a bare `rejects.toThrow()` would pass while the owner was shown
    // nothing but "that could not be saved". Re-throwing as `ConvexError` is
    // what makes the reason survive the trip.
    await expect(
      owner.as.mutation(api.publicSheet.setPublic, {
        kind: 'pilot',
        appId: 'broken',
        isPublic: true,
      })
    ).rejects.toThrow(/cannot be shared publicly/)

    expect(await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'broken' })).toBeNull()
  })
})

describe('a published mech carries its pilot’s contributions', () => {
  test('resolves the piloting pilot through softLinks', async () => {
    // ADR-029: Beefcake raises the PILOTED mech's Max SP and Cargo. The frozen
    // store carries no pilot and no links, so without this a public mech reads
    // lower than the same mech on its owner's sheet — which would make the live
    // path worse than the snapshot it is offered as an upgrade to.
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')

    await t.run(async (ctx) => {
      await ctx.db.insert('pilots', {
        gameId: null,
        ownerId: owner.userId,
        appId: 'pilot-app',
        body: { callsign: 'Vex', abilities: ['beefcake'] },
        updatedAt: Date.now(),
      })
      await ctx.db.insert('mechs', {
        gameId: null,
        ownerId: owner.userId,
        appId: 'mech-app',
        publicRead: true,
        body: { name: 'Rustjaw', chassisRef: 'mule' },
        updatedAt: Date.now(),
      })
      await ctx.db.insert('softLinks', {
        gameId: null,
        from: { type: 'mech', id: 'mech-app' },
        to: { type: 'pilot', id: 'pilot-app' },
        type: 'mech-to-pilot',
      })
    })

    const result = await t.query(api.publicSheet.get, { kind: 'mech', appId: 'mech-app' })
    expect(result?.pilotAbilities).toEqual(['beefcake'])
  })

  test('an unpiloted mech reports no abilities rather than failing', async () => {
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await t.run(async (ctx) =>
      ctx.db.insert('mechs', {
        gameId: null,
        ownerId: owner.userId,
        appId: 'lonely',
        publicRead: true,
        body: { name: 'Rustjaw', chassisRef: 'mule' },
        updatedAt: Date.now(),
      })
    )

    const result = await t.query(api.publicSheet.get, { kind: 'mech', appId: 'lonely' })
    expect(result?.pilotAbilities).toEqual([])
  })

  test('a pilot sheet carries no pilotAbilities key at all', async () => {
    // Only a mech has a piloting context; emitting an empty array everywhere
    // would imply the concept applies where it does not.
    const t = testConvex()
    const owner = await makeUser(t, 'Owner')
    await seedPilot(t, owner.userId)
    await owner.as.mutation(api.publicSheet.setPublic, {
      kind: 'pilot',
      appId: 'app-1',
      isPublic: true,
    })

    const result = await t.query(api.publicSheet.get, { kind: 'pilot', appId: 'app-1' })
    expect(result).not.toBeNull()
    expect(result === null ? true : 'pilotAbilities' in result).toBe(false)
  })
})
