/**
 * What counts as isolated local-only data, and what gets moved (ADR-035).
 *
 * These drive the rule itself rather than a copy of it, for the same reason
 * `pruneRules.test.ts` does: this decides what is uploaded on somebody's behalf
 * and what is left where only one browser can see it. A parallel implementation
 * in a test file is a rule that can pass while the code does the opposite.
 */

import { describe, expect, test } from 'bun:test'
import type { LegacyLocalData } from '../../db/legacyLocalData'
import {
  buildLegacyExportBundle,
  countStranded,
  isStranded,
  selectStranded,
  shelve,
} from '../legacyMigration'

const NO_GAMES: ReadonlySet<string> = new Set()
const NOTHING: ReadonlySet<string> = new Set()

const empty: LegacyLocalData = {
  pilots: [],
  mechs: [],
  crawlers: [],
  softLinks: [],
  mechPatterns: [],
  encounterNpcs: [],
}

const served = {
  pilots: [] as { body: unknown }[],
  mechs: [] as { body: unknown }[],
  crawlers: [] as { body: unknown }[],
  mechPatterns: [] as { body: unknown }[],
  encounterNpcs: [] as { body: unknown }[],
}

describe('shelve', () => {
  test('writes gameId: null explicitly rather than deleting the key', () => {
    // `containerOf` reads `null` as "shelved, decided" and `undefined` as
    // "predates the split, fall back to workspaceId" — and that fallback is
    // where the phantom Game came from. Deleting the key would re-open it.
    const phantom: Record<string, unknown> = { id: 'a', gameId: 'phantom' }
    expect(shelve(phantom)).toEqual({ id: 'a', gameId: null })
    expect('gameId' in shelve({ id: 'a' } as Record<string, unknown>)).toBe(true)
  })

  test('leaves workspaceId alone', () => {
    // The entity schemas are `.strict()` and still declare it, and `containerOf`
    // never reaches the fallback once gameId is null. Stripping it would be an
    // unrelated irreversible edit riding along with a migration.
    const preSplit: Record<string, unknown> = { id: 'a', workspaceId: 'ws-1' }
    expect(shelve(preSplit)).toEqual({ id: 'a', workspaceId: 'ws-1', gameId: null })
  })
})

describe('isStranded', () => {
  test('a row the account owns is not stranded, wherever it lives', () => {
    // `listMine` returns everything the caller owns in ANY container, so its
    // presence there settles the question on its own.
    expect(isStranded({ id: 'a', gameId: null }, new Set(['a']), NO_GAMES)).toBe(false)
    expect(isStranded({ id: 'a', gameId: 'g1' }, new Set(['a']), NO_GAMES)).toBe(false)
  })

  test('a row in a Game the account belongs to is not stranded either', () => {
    // These are the rows `GameRoster` caches on purpose: a Game's unclaimed
    // pre-gens and its communal crawler have NO owner, so they are legitimately
    // absent from `listMine` while being entirely server-backed. Claiming one
    // would copy somebody else's character onto your shelf.
    expect(isStranded({ id: 'a', gameId: 'g1' }, NOTHING, new Set(['g1']))).toBe(false)
  })

  test('an unowned shelf row is stranded — it never reached the server', () => {
    expect(isStranded({ id: 'a', gameId: null }, NOTHING, NO_GAMES)).toBe(true)
  })

  test('a row addressed to a Game that does not exist is stranded', () => {
    // The case that produced the bug report. Migration v13 mapped every
    // non-Default Workspace onto `gameId: <that workspace id>`, and those ids
    // name no real Game. Signed out nothing filters and the pile renders whole;
    // signed in, `Roster` scopes to the active container and every one of them
    // vanishes. A container nobody can reach is not a container.
    expect(isStranded({ id: 'a', gameId: 'ws-1' }, NOTHING, new Set(['g1']))).toBe(true)
  })

  test('a pre-split row still resolving through workspaceId is stranded too', () => {
    // `containerOf` falls back to `workspaceId` when gameId is absent, so this
    // reads as a Game — and it is one that cannot exist, for the same reason.
    expect(isStranded({ id: 'a', workspaceId: 'ws-1' }, NOTHING, NO_GAMES)).toBe(true)
  })
})

describe('selectStranded', () => {
  test('sends the stranded rows, shelved', () => {
    const work = selectStranded(
      { ...empty, pilots: [{ id: 'p1', gameId: 'ws-1' }] },
      served,
      NO_GAMES
    )
    expect(work.pilots).toEqual([{ id: 'p1', gameId: null }])
    expect(countStranded(work)).toBe(1)
  })

  test('sends nothing once the account already owns everything', () => {
    // The steady state on every load after the first, and what lets the
    // migration window finally close.
    const work = selectStranded(
      { ...empty, pilots: [{ id: 'p1', gameId: null }] },
      { ...served, pilots: [{ body: { id: 'p1' } }] },
      NO_GAMES
    )
    expect(countStranded(work)).toBe(0)
    expect(work.softLinks).toHaveLength(0)
  })

  test('leaves a Game the account belongs to alone', () => {
    const work = selectStranded(
      { ...empty, mechs: [{ id: 'm1', gameId: 'g1' }] },
      served,
      new Set(['g1'])
    )
    expect(work.mechs).toHaveLength(0)
  })

  test('carries only the links attached to what is moving', () => {
    /*
     * Sending every local link would be SAFE — `claimLocal` matches a link by
     * its (from, to, kind) triple and reports a repeat as `alreadyPresent` — but
     * a non-zero `alreadyPresent` is what stops the migration being marked
     * complete. A browser with nothing left to migrate would re-send its links
     * forever and never close its window.
     */
    const work = selectStranded(
      {
        ...empty,
        pilots: [{ id: 'p1', gameId: null }],
        softLinks: [
          { id: 'l1', from: { type: 'pilot', id: 'p1' }, to: { type: 'mech', id: 'm9' } },
          { id: 'l2', from: { type: 'pilot', id: 'other' }, to: { type: 'mech', id: 'm9' } },
        ],
      },
      served,
      NO_GAMES
    )
    expect(work.softLinks).toHaveLength(1)
    expect((work.softLinks[0] as { id: string }).id).toBe('l1')
  })

  test('patterns and NPCs are decided by ownership alone', () => {
    // Neither carries a container a player can navigate to — a pattern is a
    // saved loadout and a shelf NPC is a personal tray — so there is no
    // phantom-Game case to consider for them.
    const work = selectStranded(
      { ...empty, mechPatterns: [{ id: 'pat1' }, { id: 'pat2' }], encounterNpcs: [{ id: 'n1' }] },
      { ...served, mechPatterns: [{ body: { id: 'pat1' } }] },
      NO_GAMES
    )
    expect(work.mechPatterns).toHaveLength(1)
    expect(work.encounterNpcs).toHaveLength(1)
    expect(countStranded(work)).toBe(2)
  })

  test('a row with no id is dropped rather than sent', () => {
    // It cannot be addressed, so it cannot be reconciled — and sending it would
    // count as `skipped` server-side and hold the window open forever.
    const work = selectStranded({ ...empty, pilots: [{ gameId: null }, null] }, served, NO_GAMES)
    expect(work.pilots).toHaveLength(0)
  })
})

describe('countStranded', () => {
  test('excludes soft links, which are wiring rather than things', () => {
    // "3 builds" reads correctly to a player; "5 builds" with two links does
    // not. Same rule as `countAnonymousWork`.
    expect(countStranded({ ...empty, pilots: [{}], softLinks: [{}, {}] } as never)).toBe(1)
  })
})

describe('buildLegacyExportBundle', () => {
  test('is built from the device rows, not from a store', () => {
    // `buildExportBundle` reads the entity store, which for an anonymous session
    // is the in-memory backend — so it would hand somebody downloading their
    // pre-account roster an empty file. This is the whole reason it exists.
    const bundle = buildLegacyExportBundle({
      ...empty,
      pilots: [{ id: 'p1' }],
      mechPatterns: [{ id: 'pat1' }],
    })
    expect(bundle.entities.pilots).toHaveLength(1)
    expect(bundle.mechPatterns).toHaveLength(1)
    expect(bundle.schemaVersion).toBe(2)
  })
})
