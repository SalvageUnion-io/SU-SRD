import { describe, expect, test } from 'bun:test'
import { enforceContainerLimits } from '../container.js'
import {
  channelCard,
  crewCard,
  denialMessage,
  gameSheetUrl,
  gamesCard,
  gameUrl,
  gauge,
  ITUN_ORIGIN,
  ownerLabel,
  shelfCard,
  shelfSheetUrl,
} from '../gameCards.js'
import type { CrewResult, OwnedEntity } from '../itun/types.js'
import { blockStarting, cardText, cardTexts, cardUrl } from './cardText.js'

/**
 * Card builders for the ITUN Game commands.
 *
 * These are pure `data → ContainerData`, so every one of them is exercised here
 * with no Discord client, no network and no mock. The maxima are DERIVED from
 * chassis and class data (the workspace preload loads the dataset); Convex's
 * crew.vitals derives the same numbers, and moving the bot onto those is #1068.
 */

const WEB = ITUN_ORIGIN

function pilot(overrides: Partial<OwnedEntity> & { body?: Record<string, unknown> }): OwnedEntity {
  return {
    id: 'p1',
    appId: 'app-p1',
    ownerId: 'u1',
    ownerName: 'alxjrvs',
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
    const card = crewCard(
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
            body: { name: 'Mule', chassisRef: 'mule', currentSP: 8, currentHeat: 3 },
          },
        ],
        crawler: null,
      },
      WEB
    )
    const value = cardText(card)
    expect(value).toContain('6/10')
    expect(value).toContain('3/5')
    expect(value).toContain('8/12')
    expect(value).toContain('3/6')
  })

  test('still reads the historical lower-case spelling', () => {
    // Salvage-tolerant, like ITUN's own data layer: rows written before the
    // spelling was settled must not render as an undamaged crew.
    const card = crewCard(
      {
        game: { gameId: 'g1', name: 'Tenacity' },
        viewerId: 'u1',
        pilots: [pilot({ body: { callsign: 'Rook', currentHp: 4, currentAp: 1 } })],
        mechs: [],
        crawler: null,
      },
      WEB
    )
    expect(cardText(card)).toContain('4/10')
  })
})

describe('absent vitals', () => {
  test('an unwritten HP/AP/SP means FULL, not zero', () => {
    // The field is only written once something changes it, and all 35 call
    // sites in the app read it as `?? max`. Defaulting to 0 would render a
    // fresh, undamaged crew as wiped out — backwards on the one surface built
    // to show exactly this.
    const card = crewCard(
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
            body: { name: 'Mule', chassisRef: 'mule' },
          },
        ],
        crawler: null,
      },
      WEB
    )
    const value = cardText(card)
    expect(value).toContain('10/10')
    expect(value).toContain('5/5')
    expect(value).toContain('12/12')
    // ...and the crew is emphatically NOT flagged as critical.
    expect(card.accent).not.toBe(0xb0432b)
  })

  test('an unwritten Heat means COLD, which is zero', () => {
    // The one field that reads the other way: a mech starts at no heat and
    // gains it, where SP starts full and is lost.
    const card = crewCard(
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
            body: { name: 'Mule', chassisRef: 'mule' },
          },
        ],
        crawler: null,
      },
      WEB
    )
    expect(cardText(card)).toContain('0/6')
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

describe('crewCard', () => {
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
    const card = crewCard(
      crewOf({
        pilots: [pilot({ id: 'p1', ownerId: 'u1', ownerName: 'alxjrvs' })],
        mechs: [
          {
            id: 'm1',
            appId: 'app-m1',
            ownerId: 'u1',
            ownerName: 'alxjrvs',
            body: { name: 'Iron Mongrel', chassisRef: 'mule', currentSP: 8, currentHeat: 3 },
          },
        ],
      }),
      WEB
    )

    // One owner, one field — the pilot and the mech read as one crewmate,
    // on the rail (`**Name** value`, not a `**Name**` slab heading).
    const text = cardText(card)
    expect(text.split('**alxjrvs**')).toHaveLength(2)
    expect(blockStarting(card, '**alxjrvs** ')).toBeDefined()
    // Derived from the `mule` chassis, which the server could not have done.
    expect(text).toContain('8/12')
    expect(text).toContain('3/6')
  })

  test('renders unclaimed entities in their own bucket rather than dropping them', () => {
    const card = crewCard(crewOf({ pilots: [pilot({ ownerId: null, ownerName: null })] }), WEB)
    expect(blockStarting(card, '**Unclaimed** ')).toBeDefined()
  })

  test('marks the crew critical when a mech is wrecked', () => {
    const healthy = crewCard(crewOf(), WEB)
    const wrecked = crewCard(
      crewOf({
        mechs: [
          {
            id: 'm1',
            appId: 'app-m1',
            ownerId: 'u1',
            ownerName: 'alxjrvs',
            body: { name: 'Iron Mongrel', chassisRef: 'mule', currentSP: 0 },
          },
        ],
      }),
      WEB
    )
    // The one sanctioned deviation from rust, reusing the warm ramp the design
    // system already shares with the bot's roll outcomes.
    expect(wrecked.accent).not.toBe(healthy.accent)
    expect(cardText(wrecked)).toContain('✖')
  })

  test('links back to the game in the app', () => {
    expect(cardUrl(crewCard(crewOf(), WEB))).toContain('g1')
  })

  test('says so plainly when nothing is in play', () => {
    const card = crewCard(crewOf({ pilots: [], mechs: [] }), WEB)
    // Heading, the line saying so, and the footer: no crewmate fields.
    expect(cardTexts(card)).toHaveLength(3)
    expect(cardText(card)).toContain('Nothing in play')
  })

  test('a full table arrives whole, shedding no block', () => {
    const table = Array.from({ length: 8 }, (_, i) =>
      pilot({ id: `p${i}`, ownerId: `u${i}`, ownerName: `Crew ${i}` })
    )
    const card = crewCard(crewOf({ pilots: table }), WEB)
    expect(enforceContainerLimits(card).blocks).toEqual(card.blocks)
  })
})

describe('deep links', () => {
  test('a game links to its own route, not a query string', () => {
    // /games/$gameId is the real TanStack route (games_.$gameId.tsx). A link
    // that 404s reads as the app having lost the game, not as the bot guessing.
    expect(gameUrl(WEB, 'g1')).toBe(`${WEB}/games/g1`)
  })

  test('your OWN shelf entity links by app id, into your own browser', () => {
    // /sheet/$kind/$id resolves out of IndexedDB by app-level id. That is right
    // for the shelf, where the reader IS the owner and holds the entity.
    expect(shelfSheetUrl(WEB, 'pilots', 'app-p1')).toBe(`${WEB}/sheet/pilot/app-p1`)
    expect(shelfSheetUrl(WEB, 'mechs', 'app-m1')).toBe(`${WEB}/sheet/mech/app-m1`)
  })

  test('a shelf entity with no app id has no link at all', () => {
    // Unclaimed server-side entities have no local counterpart to open.
    expect(shelfSheetUrl(WEB, 'pilots', null)).toBeNull()
    expect(shelfSheetUrl(WEB, 'pilots', '')).toBeNull()
  })

  test("a CREWMATE's sheet links to the Game view, by Convex id", () => {
    // The regression this guards: the crew board and /su sheet both used to
    // emit /sheet/$kind/$appId for other people's entities, which reads the
    // CLICKER's IndexedDB. A crewmate does not have that entity locally, so
    // every such link opened an empty page. /games/$gameId/view/... is the
    // read-only route addressed by the Convex row id precisely because the
    // viewer has no local copy.
    expect(gameSheetUrl(WEB, 'g1', 'pilots', 'cx-p1')).toBe(`${WEB}/games/g1/view/pilot/cx-p1`)
    expect(gameSheetUrl(WEB, 'g1', 'mechs', 'cx-m1')).toBe(`${WEB}/games/g1/view/mech/cx-m1`)
    expect(gameSheetUrl(WEB, 'g1', 'crawlers', 'cx-c1')).toBe(`${WEB}/games/g1/view/crawler/cx-c1`)
  })

  test('the game view link needs both ids', () => {
    expect(gameSheetUrl(WEB, '', 'pilots', 'cx-p1')).toBeNull()
    expect(gameSheetUrl(WEB, 'g1', 'pilots', '')).toBeNull()
  })

  test('the crew board links every crewmate into the Game view', () => {
    const card = crewCard(
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
    const text = cardText(card)
    const linked = text.slice(text.indexOf('**alxjrvs**'), text.indexOf('**Unclaimed**'))
    const unclaimed = text.slice(text.indexOf('**Unclaimed**'))

    // By Convex id into the Game view, not by app id into /sheet/…: a crew
    // board is read by the whole table, and nobody but the owner has the
    // owner's IndexedDB.
    expect(linked).toContain(`${WEB}/games/g1/view/pilot/p1`)
    expect(linked).not.toContain(`${WEB}/sheet/pilot/app-p1`)

    // An UNCLAIMED entity is now linkable, where it previously rendered bare.
    // That is the point of addressing by row id: the entity exists on the
    // server whether or not anyone has ever claimed it into a browser, so
    // there is a real page to open. Only the local route needed an app id.
    expect(unclaimed).toContain('Nobody')
    expect(unclaimed).toContain(`${WEB}/games/g1/view/pilot/p2`)
  })

  test('the shelf renders an unlinkable entity as a bare name', () => {
    const card = shelfCard(
      { pilots: [{ id: 'p1', appId: null, body: { callsign: 'Rook' } }], mechs: [] },
      WEB
    )
    expect(blockStarting(card, '**Pilots')).toBe('**Pilots (1)** Rook')
  })
})

describe('unclaimed ordering', () => {
  test('unclaimed renders LAST, after every owner', () => {
    // It is a state worth showing, not a crewmate — it should not be the first
    // thing the table reads. Previously it sorted FIRST, because the sentinel
    // key began with a space.
    const card = crewCard(
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
    const text = cardText(card)
    // Owners stay alphabetical among themselves, and Unclaimed comes after.
    expect(text.indexOf('**alxjrvs**')).toBeLessThan(text.indexOf('**Zed**'))
    expect(text.indexOf('**Zed**')).toBeLessThan(text.indexOf('**Unclaimed**'))
  })

  test('the aboard count excludes the unclaimed bucket', () => {
    const card = crewCard(
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
    expect(cardText(card)).toContain('1 aboard')
  })
})

describe('shelfCard', () => {
  test('explains an empty shelf rather than rendering a blank card', () => {
    const card = shelfCard({ pilots: [], mechs: [] }, WEB)
    expect(cardText(card)).not.toContain('**Pilots')
    expect(cardText(card)).toContain('Nothing in My Stuff')
  })

  test('links each entity to its sheet', () => {
    const card = shelfCard(
      { pilots: [{ id: 'p1', appId: 'app-p1', body: { callsign: 'Rook' } }], mechs: [] },
      WEB
    )
    expect(blockStarting(card, '**Pilots')).toContain(`${WEB}/sheet/pilot/app-p1`)
  })
})

describe('gamesCard and channelCard', () => {
  test('an empty game list is stated, not implied', () => {
    expect(cardText(gamesCard([], WEB))).toContain('No games yet')
  })

  test('roles read as base role plus modifier, never as three roles', () => {
    const card = gamesCard(
      [{ gameId: 'g1', name: 'Tenacity', mediator: true, organizer: true }],
      WEB
    )
    // ADR-030 §3: Organizer is a flag ON a base role, so it renders alongside
    // Mediator rather than replacing it.
    expect(cardText(card)).toContain('Mediator · Organizer')
  })

  test('the channel card shows Downtime only while it is running', () => {
    const base = {
      game: { gameId: 'g1', name: 'Tenacity' },
      members: [
        {
          userId: 'u1',
          displayName: 'alxjrvs',
          mediator: false,
          organizer: true,
        },
      ],
    }
    const idle = channelCard(
      { ...base, downtime: { running: false, stepIndex: null, completed: 0, upkeepSpent: false } },
      WEB
    )
    const running = channelCard(
      { ...base, downtime: { running: true, stepIndex: 1, completed: 1, upkeepSpent: true } },
      WEB
    )
    expect(blockStarting(idle, '**Downtime**')).toBeUndefined()
    // stepIndex is zero-based on the server and one-based for humans.
    expect(blockStarting(running, '**Downtime**')).toContain('Step 2')
  })
})
