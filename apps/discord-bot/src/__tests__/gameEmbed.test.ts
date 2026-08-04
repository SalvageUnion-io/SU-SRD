import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  buildChannelEmbed,
  buildCrewEmbed,
  buildGamesEmbed,
  buildShelfEmbed,
  denialMessage,
  gameUrl,
  gauge,
  ownerLabel,
  sheetUrl,
} from '../gameEmbed.js'
import type { CrewResult, OwnedEntity } from '../itun/types.js'

/**
 * Embed builders for the ITUN Game commands.
 *
 * These are pure `data → EmbedData`, so every one of them is exercised here
 * with no Discord client, no network and no mock — the same property that made
 * `lookupEmbed.ts` testable, for the same reason.
 */

const WEB = 'https://intheunionnow.com'

beforeAll(async () => {
  // The maxima are DERIVED from chassis and class data, so the builders are
  // meaningless without the dataset loaded. That dependency is the point: the
  // server cannot compute these, and the bot can.
  await SalvageUnionReference.preload('all')
})

function pilot(overrides: Partial<OwnedEntity> & { body?: Record<string, unknown> }): OwnedEntity {
  return {
    id: 'p1',
    appId: 'app-p1',
    ownerId: 'u1',
    ownerName: 'alxjrvs',
    present: false,
    body: { callsign: 'Rook', currentHP: 6, currentAP: 3 },
    ...overrides,
  }
}

describe('gauge', () => {
  test('renders a proportional bar with the raw numbers beside it', () => {
    // The numbers matter more than the bar: a bar is a glance, `6/10` is the
    // answer to "how bad is it".
    expect(gauge(6, 10)).toBe('██████░░░░ 6/10')
    expect(gauge(10, 10)).toBe('██████████ 10/10')
    expect(gauge(0, 10)).toBe('░░░░░░░░░░ 0/10')
  })

  test('tracks small maxima exactly rather than scaling them', () => {
    // AP 5 and Heat 6 are the common SU values; showing 3/5 as a ten-segment
    // approximation would round a number the player is tracking precisely.
    expect(gauge(3, 5)).toBe('███░░ 3/5')
    expect(gauge(3, 6, '▲')).toBe('▲▲▲░░░ 3/6')
  })

  test('compresses a maximum larger than ten segments', () => {
    expect(gauge(10, 20)).toBe('█████░░░░░ 10/20')
  })

  test('degrades rather than throwing on missing or nonsensical data', () => {
    // Bodies are opaque on the server (`v.any()`), so absent fields are a
    // normal input here, not an exceptional one.
    expect(gauge(null, null)).toBe('—')
    expect(gauge(4, null)).toBe('4')
    expect(gauge(null, 10)).toBe('░░░░░░░░░░ 0/10')
    // Over-max (a stale override, a hand-edited body) clamps the BAR but
    // reports the real number — hiding it would be lying about the sheet.
    expect(gauge(14, 10)).toBe('██████████ 14/10')
  })
})

describe('vital field names', () => {
  test('reads the CANONICAL schema spellings', () => {
    // The regression this guards is not hypothetical: `crew.vitals` shipped
    // reading `currentHp` while apps/itun/src/lib/schemas/pilot.ts defines
    // `currentHP`, so every vital rendered as an em-dash indistinguishable
    // from an undamaged crew (#656). Nothing links these two workspaces at
    // build time, so only a test can hold the spelling.
    const embed = buildCrewEmbed(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [pilot({ body: { callsign: 'Rook', currentHP: 6, currentAP: 3 } })],
        mechs: [
          {
            id: 'm1',
            appId: 'app-m1',
            ownerId: 'u1',
            ownerName: 'alxjrvs',
            present: false,
            body: { name: 'Mule', chassisRef: 'mule', currentSP: 8, currentHeat: 3 },
          },
        ],
        crawler: null,
      },
      WEB
    )
    const value = embed.fields[0]?.value ?? ''
    expect(value).toContain('6/10')
    expect(value).toContain('3/5')
    expect(value).toContain('8/12')
    expect(value).toContain('3/6')
  })

  test('still reads the historical lower-case spelling', () => {
    // Salvage-tolerant, like ITUN's own data layer: rows written before the
    // spelling was settled must not render as an undamaged crew.
    const embed = buildCrewEmbed(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [pilot({ body: { callsign: 'Rook', currentHp: 4, currentAp: 1 } })],
        mechs: [],
        crawler: null,
      },
      WEB
    )
    expect(embed.fields[0]?.value).toContain('4/10')
  })
})

describe('absent vitals', () => {
  test('an unwritten HP/AP/SP means FULL, not zero', () => {
    // The field is only written once something changes it, and all 35 call
    // sites in the app read it as `?? max`. Defaulting to 0 would render a
    // fresh, undamaged crew as wiped out — backwards on the one surface built
    // to show exactly this.
    const embed = buildCrewEmbed(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [pilot({ body: { callsign: 'Rook' } })],
        mechs: [
          {
            id: 'm1',
            appId: 'app-m1',
            ownerId: 'u1',
            ownerName: 'alxjrvs',
            present: false,
            body: { name: 'Mule', chassisRef: 'mule' },
          },
        ],
        crawler: null,
      },
      WEB
    )
    const value = embed.fields[0]?.value ?? ''
    expect(value).toContain('10/10')
    expect(value).toContain('5/5')
    expect(value).toContain('12/12')
    // ...and the crew is emphatically NOT flagged as critical.
    expect(embed.color).not.toBe(0xb0432b)
  })

  test('an unwritten Heat means COLD, which is zero', () => {
    // The one field that reads the other way: a mech starts at no heat and
    // gains it, where SP starts full and is lost.
    const embed = buildCrewEmbed(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [],
        mechs: [
          {
            id: 'm1',
            appId: 'app-m1',
            ownerId: 'u1',
            ownerName: 'alxjrvs',
            present: false,
            body: { name: 'Mule', chassisRef: 'mule' },
          },
        ],
        crawler: null,
      },
      WEB
    )
    expect(embed.fields[0]?.value).toContain('0/6')
  })
})

describe('ownerLabel', () => {
  test('renders an unowned entity as a state, never a blank', () => {
    // ADR-030: a null ownerId is a normal state, and every surface that reads
    // an owner has to say so rather than render an empty string.
    expect(ownerLabel(pilot({ ownerId: null, ownerName: null }))).toBe('Unclaimed')
  })

  test('falls back when the name is missing but the owner is not', () => {
    expect(ownerLabel(pilot({ ownerName: null }))).toBe('Crewmate')
  })
})

describe('denialMessage', () => {
  test('an unlinked user is told there is nothing to link', () => {
    const message = denialMessage('unlinked', WEB)
    // The whole point of Discord-as-sole-provider: signing in IS the linking
    // step, so the message must not imply a code to paste.
    expect(message).toContain('nothing to copy across')
    expect(message).toContain(`${WEB}/account`)
  })

  test('an unbound channel points at the command that fixes it', () => {
    expect(denialMessage('unbound', WEB)).toContain('/su game bind')
  })

  test('every reason produces a non-empty message', () => {
    for (const reason of [
      'unlinked',
      'unbound',
      'not-a-member',
      'forbidden',
      'not-found',
    ] as const) {
      expect(denialMessage(reason, WEB).length).toBeGreaterThan(0)
    }
  })
})

describe('buildCrewEmbed', () => {
  function crewOf(overrides: Partial<CrewResult> = {}): CrewResult {
    return {
      game: { gameId: 'g1', name: 'Tenacity' },
      viewerId: 'u1',
      pilots: [pilot({})],
      mechs: [],
      crawler: null,
      ...overrides,
    }
  }

  test('groups by owner, one inline field each', () => {
    const embed = buildCrewEmbed(
      crewOf({
        pilots: [pilot({ id: 'p1', ownerId: 'u1', ownerName: 'alxjrvs' })],
        mechs: [
          {
            id: 'm1',
            appId: 'app-m1',
            ownerId: 'u1',
            ownerName: 'alxjrvs',
            present: false,
            body: { name: 'Iron Mongrel', chassisRef: 'mule', currentSP: 8, currentHeat: 3 },
          },
        ],
      }),
      WEB
    )

    // One owner, one field — the pilot and the mech read as one crewmate.
    expect(embed.fields).toHaveLength(1)
    expect(embed.fields[0]?.inline).toBe(true)
    expect(embed.fields[0]?.name).toContain('alxjrvs')
    // Derived from the `mule` chassis, which the server could not have done.
    expect(embed.fields[0]?.value).toContain('8/12')
    expect(embed.fields[0]?.value).toContain('3/6')
  })

  test('renders unclaimed entities in their own bucket rather than dropping them', () => {
    const embed = buildCrewEmbed(
      crewOf({ pilots: [pilot({ ownerId: null, ownerName: null })] }),
      WEB
    )
    expect(embed.fields).toHaveLength(1)
    expect(embed.fields[0]?.name).toContain('Unclaimed')
  })

  test('marks the crew critical when a mech is wrecked', () => {
    const healthy = buildCrewEmbed(crewOf(), WEB)
    const wrecked = buildCrewEmbed(
      crewOf({
        mechs: [
          {
            id: 'm1',
            appId: 'app-m1',
            ownerId: 'u1',
            ownerName: 'alxjrvs',
            present: false,
            body: { name: 'Iron Mongrel', chassisRef: 'mule', currentSP: 0 },
          },
        ],
      }),
      WEB
    )
    // The one sanctioned deviation from rust, reusing the warm ramp the design
    // system already shares with the bot's roll outcomes.
    expect(wrecked.color).not.toBe(healthy.color)
    expect(wrecked.fields[0]?.value).toContain('✖')
  })

  test('links back to the game in the app', () => {
    expect(buildCrewEmbed(crewOf(), WEB).url).toContain('g1')
  })

  test('says so plainly when nothing is in play', () => {
    const embed = buildCrewEmbed(crewOf({ pilots: [], mechs: [] }), WEB)
    expect(embed.fields).toHaveLength(0)
    expect(embed.description).toContain('Nothing in play')
  })

  test('never exceeds Discord’s 25-field ceiling', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      pilot({ id: `p${i}`, ownerId: `u${i}`, ownerName: `Crew ${i}` })
    )
    expect(buildCrewEmbed(crewOf({ pilots: many }), WEB).fields.length).toBeLessThanOrEqual(25)
  })
})

describe('deep links', () => {
  test('a game links to its own route, not a query string', () => {
    // /games/$gameId is the real TanStack route (games_.$gameId.tsx). A link
    // that 404s reads as the app having lost the game, not as the bot guessing.
    expect(gameUrl(WEB, 'g1')).toBe(`${WEB}/games/g1`)
  })

  test('a sheet links by APP id, never by the Convex id', () => {
    // /sheet/$kind/$id resolves out of IndexedDB by app-level id, so a URL
    // built from the Convex `_id` opens nothing at all.
    expect(sheetUrl(WEB, 'pilots', 'app-p1')).toBe(`${WEB}/sheet/pilot/app-p1`)
    expect(sheetUrl(WEB, 'mechs', 'app-m1')).toBe(`${WEB}/sheet/mech/app-m1`)
  })

  test('an entity with no app id has no link at all', () => {
    // Unclaimed server-side entities have no local counterpart to open.
    expect(sheetUrl(WEB, 'pilots', null)).toBeNull()
    expect(sheetUrl(WEB, 'pilots', '')).toBeNull()
  })

  test('the crew board links what it can and leaves the rest bare', () => {
    const embed = buildCrewEmbed(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [
          pilot({ appId: 'app-p1', body: { callsign: 'Rook', currentHP: 6 } }),
          pilot({
            id: 'p2',
            appId: null,
            ownerId: null,
            ownerName: null,
            body: { callsign: 'Nobody' },
          }),
        ],
        mechs: [],
        crawler: null,
      },
      WEB
    )
    const linked = embed.fields.find((f) => f.name.includes('alxjrvs'))?.value ?? ''
    const bare = embed.fields.find((f) => f.name.includes('Unclaimed'))?.value ?? ''
    expect(linked).toContain(`${WEB}/sheet/pilot/app-p1`)
    expect(bare).toContain('Nobody')
    expect(bare).not.toContain('](')
  })

  test('the shelf renders an unlinkable entity as a bare name', () => {
    const embed = buildShelfEmbed(
      { pilots: [{ id: 'p1', appId: null, body: { callsign: 'Rook' } }], mechs: [] },
      WEB
    )
    expect(embed.fields[0]?.value).toBe('Rook')
  })
})

describe('unclaimed ordering', () => {
  test('unclaimed renders LAST, after every owner', () => {
    // It is a state worth showing, not a crewmate — it should not be the first
    // thing the table reads. Previously it sorted FIRST, because the sentinel
    // key began with a space.
    const embed = buildCrewEmbed(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [
          pilot({ id: 'p0', ownerId: null, ownerName: null, body: { callsign: 'Nobody' } }),
          pilot({ id: 'p1', ownerId: 'u9', ownerName: 'Zed' }),
          pilot({ id: 'p2', ownerId: 'u1', ownerName: 'alxjrvs' }),
        ],
        mechs: [],
        crawler: null,
      },
      WEB
    )
    const names = embed.fields.map((f) => f.name)
    expect(names[names.length - 1]).toContain('Unclaimed')
    // Owners stay alphabetical among themselves.
    expect(names[0]).toContain('alxjrvs')
    expect(names[1]).toContain('Zed')
  })

  test('the aboard count excludes the unclaimed bucket', () => {
    const embed = buildCrewEmbed(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [
          pilot({ id: 'p0', ownerId: null, ownerName: null }),
          pilot({ id: 'p1', ownerId: 'u1', ownerName: 'alxjrvs' }),
        ],
        mechs: [],
        crawler: null,
      },
      WEB
    )
    expect(embed.description).toContain('1 aboard')
  })
})

describe('buildShelfEmbed', () => {
  test('explains an empty shelf rather than rendering a blank card', () => {
    const embed = buildShelfEmbed({ pilots: [], mechs: [] }, WEB)
    expect(embed.fields).toHaveLength(0)
    expect(embed.description).toContain('Nothing on your shelf')
  })

  test('links each entity to its sheet', () => {
    const embed = buildShelfEmbed(
      { pilots: [{ id: 'p1', appId: 'app-p1', body: { callsign: 'Rook' } }], mechs: [] },
      WEB
    )
    expect(embed.fields[0]?.value).toContain(`${WEB}/sheet/pilot/app-p1`)
  })
})

describe('buildGamesEmbed and buildChannelEmbed', () => {
  test('an empty game list is stated, not implied', () => {
    expect(buildGamesEmbed([], WEB).description).toContain('No games yet')
  })

  test('roles read as base role plus modifier, never as three roles', () => {
    const embed = buildGamesEmbed(
      [{ gameId: 'g1', name: 'Tenacity', mediator: true, organizer: true }],
      WEB
    )
    // ADR-030 §3: Organizer is a flag ON a base role, so it renders alongside
    // Mediator rather than replacing it.
    expect(embed.description).toContain('Mediator · Organizer')
  })

  test('the channel card shows Downtime only while it is running', () => {
    const base = {
      game: { gameId: 'g1', name: 'Tenacity' },
      members: [
        {
          userId: 'u1',
          displayName: 'alxjrvs',
          present: true,
          mediator: false,
          organizer: true,
        },
      ],
    }
    const idle = buildChannelEmbed(
      { ...base, downtime: { running: false, stepIndex: null, completed: 0, upkeepSpent: false } },
      WEB
    )
    const running = buildChannelEmbed(
      { ...base, downtime: { running: true, stepIndex: 1, completed: 1, upkeepSpent: true } },
      WEB
    )
    expect(idle.fields.map((f) => f.name)).not.toContain('Downtime')
    expect(running.fields.map((f) => f.name)).toContain('Downtime')
    // stepIndex is zero-based on the server and one-based for humans.
    expect(running.fields.find((f) => f.name === 'Downtime')?.value).toContain('Step 2')
  })
})
