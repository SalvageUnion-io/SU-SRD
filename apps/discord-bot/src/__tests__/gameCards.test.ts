import { describe, expect, test } from 'bun:test'
import { DISCORD_ROLL_ACCENT } from 'salvageunion-reference'
import {
  CANTINA_ORIGIN,
  denialMessage,
  gamesCard,
  gameUrl,
  gauge,
  sheetCard,
  sheetUrl,
} from '../gameCards'
import type { EntityBody, SheetResult } from '../play/types'
import { cardText, cardUrl } from './cardText'

/**
 * Card builders for the Cantina Game commands.
 *
 * These are pure `data → ContainerData`, so every one of them is exercised here
 * with no Discord client, no network and no mock. A pilot's and a mech's
 * maxima and status are the SERVER's (`SheetResult.vitals`, derived as
 * `crew.vitals` derives them); these fixtures carry what it sends for a
 * fresh pilot and a bare Mule.
 */

const WEB = CANTINA_ORIGIN
const CRITICAL = DISCORD_ROLL_ACCENT.cascade

/** A fresh pilot as the server derives it: base HP 10 and AP 5, alive. */
const PILOT_VITALS: SheetResult['vitals'] = {
  kind: 'pilot',
  maxHP: 10,
  maxAP: 5,
  status: { dead: false, injured: false, ejected: false },
  attention: false,
}

/** A bare Mule as the server derives it: SP 12, EP 6, Heat Capacity 6, intact. */
const MULE_VITALS: SheetResult['vitals'] = {
  kind: 'mech',
  maxSP: 12,
  maxEP: 6,
  maxHeat: 6,
  status: {
    destroyed: false,
    shutdown: false,
    overheating: false,
    destroyedSystems: [],
    destroyedModules: [],
  },
  attention: false,
}

function sheet(
  table: SheetResult['table'],
  body: EntityBody,
  vitals: SheetResult['vitals'] = table === 'pilots'
    ? PILOT_VITALS
    : table === 'mechs'
      ? MULE_VITALS
      : null
): SheetResult {
  return { table, id: 'cx1', appId: 'app1', publicRead: false, ownerName: 'alxjrvs', body, vitals }
}

describe('gauge', () => {
  test('puts the number first, then a proportional bar', () => {
    // The numbers matter more than the bar: a bar is a glance, `6/10` is the
    // answer to "how bad is it" — and a screen reader reaches it before ten
    // block glyphs rather than after.
    expect(gauge(6, 10)).toBe('6/10 ██████░░░░')
    expect(gauge(10, 10)).toBe('10/10 ██████████')
    expect(gauge(0, 10)).toBe('0/10 ░░░░░░░░░░')
  })

  test('tracks small maxima exactly rather than scaling them', () => {
    // AP 5 and Heat 6 are the common SU values; showing 3/5 as a ten-segment
    // approximation would round a number the player is tracking precisely.
    expect(gauge(3, 5)).toBe('3/5 ███░░')
    expect(gauge(3, 6, '▲')).toBe('3/6 ▲▲▲░░░')
  })

  test('compresses a maximum larger than ten segments', () => {
    expect(gauge(10, 20)).toBe('10/20 █████░░░░░')
  })

  test('the text style is the number alone, with no glyph', () => {
    expect(gauge(6, 10, '█', 'text')).toBe('6/10')
    expect(gauge(3, 6, '▲', 'text')).toBe('3/6')
    expect(gauge(null, 10, '█', 'text')).toBe('0/10')
    expect(gauge(4, null, '█', 'text')).toBe('4')
  })

  test('degrades rather than throwing on missing or nonsensical data', () => {
    // Bodies are opaque on the server (`v.any()`), so absent fields are a
    // normal input here, not an exceptional one.
    expect(gauge(null, null)).toBe('—')
    expect(gauge(4, null)).toBe('4')
    expect(gauge(null, 10)).toBe('0/10 ░░░░░░░░░░')
    // Over-max (a stale override, a hand-edited body) clamps the BAR but
    // reports the real number — hiding it would be lying about the sheet.
    expect(gauge(14, 10)).toBe('14/10 ██████████')
  })
})

describe('vital field names', () => {
  test('reads the CANONICAL schema spellings', () => {
    // The regression this guards is not hypothetical: `crew.vitals` shipped
    // reading `currentHp` while packages/game-domain/src/schemas/pilot.ts defines
    // `currentHP`, so every vital rendered as an em-dash indistinguishable
    // from an undamaged crew. The reads are typed against that schema
    // now; this pins that the canonical names reach the card.
    const pilotText = cardText(
      sheetCard(sheet('pilots', { callsign: 'Rook', currentHP: 6, currentAP: 3 }))
    )
    expect(pilotText).toContain('6/10')
    expect(pilotText).toContain('3/5')
    const mechText = cardText(
      sheetCard(sheet('mechs', { name: 'Mule', chassisRef: 'mule', currentSP: 8, currentHeat: 3 }))
    )
    expect(mechText).toContain('8/12')
    expect(mechText).toContain('3/6')
  })
})

describe('absent vitals', () => {
  test('an unwritten HP/AP/SP means FULL, not zero', () => {
    // The field is only written once something changes it, and all 35 call
    // sites in the app read it as `?? max`. Defaulting to 0 would render a
    // fresh, undamaged sheet as wiped out.
    const pilotCard = sheetCard(sheet('pilots', { callsign: 'Rook' }))
    expect(cardText(pilotCard)).toContain('10/10')
    expect(cardText(pilotCard)).toContain('5/5')
    const mechCard = sheetCard(sheet('mechs', { name: 'Mule', chassisRef: 'mule' }))
    expect(cardText(mechCard)).toContain('12/12')
    // ...and neither is flagged as critical.
    expect(pilotCard.accent).not.toBe(0xb0432b)
    expect(mechCard.accent).not.toBe(0xb0432b)
  })

  test('an unwritten Heat means COLD, which is zero', () => {
    // The one field that reads the other way: a mech starts at no heat and
    // gains it, where SP starts full and is lost.
    expect(cardText(sheetCard(sheet('mechs', { name: 'Mule', chassisRef: 'mule' })))).toContain(
      '0/6'
    )
  })
})

describe('the server derives the maxima and status', () => {
  test('its maxima are the ones drawn, whatever the bot could work out', () => {
    // A Mule's chassis says 12 SP; a piloted mech's Beefcake or a switched-on
    // effect can raise it, and only the server reads the seat and the pilot.
    const mech = sheet('mechs', { name: 'Mule', chassisRef: 'mule', currentSP: 13 }, {
      ...MULE_VITALS,
      maxSP: 15,
    } as SheetResult['vitals'])
    expect(cardText(sheetCard(mech))).toContain('13/15')
    // Stat Training follows the LINKED crawler's tech level, which the body's
    // own `crawlerLevel` can lag; the server's answer wins.
    const pilot = sheet('pilots', { callsign: 'Rook', crawlerLevel: 1 }, {
      ...PILOT_VITALS,
      maxHP: 12,
    } as SheetResult['vitals'])
    expect(cardText(sheetCard(pilot))).toContain('12/12')
  })

  test('a pilot the server reports dead is critical', () => {
    const dead = sheet('pilots', { callsign: 'Rook', currentHP: 0 }, {
      ...PILOT_VITALS,
      maxHP: 0,
      status: { dead: true, injured: true, ejected: false },
      attention: true,
    } as SheetResult['vitals'])
    expect(sheetCard(dead).accent).toBe(CRITICAL)
  })

  test('a mech the server reports destroyed is critical and says so', () => {
    const wreck = sheet('mechs', { name: 'Mule', chassisRef: 'mule' }, {
      ...MULE_VITALS,
      status: {
        destroyed: true,
        shutdown: true,
        overheating: false,
        destroyedSystems: [],
        destroyedModules: [],
      },
      attention: true,
    } as SheetResult['vitals'])
    const card = sheetCard(wreck)
    expect(card.accent).toBe(CRITICAL)
    expect(cardText(card)).toContain('Shutdown · Destroyed')
  })

  test('a deployment older than `vitals` shows the current values alone', () => {
    // Convex is pushed before the bot ships, but a rolled-back backend still
    // answers without the field. The bot no longer derives maxima, so the
    // honest render is the stored number, or a dash when there is none.
    const { vitals: _sent, ...older } = sheet('pilots', { callsign: 'Rook', currentHP: 6 })
    const pilot = cardText(sheetCard(older))
    expect(pilot).toContain('**Hit Points** 6\n')
    expect(pilot).toContain('**Ability Points** —')
    const mech = cardText(
      sheetCard(sheet('mechs', { name: 'Mule', chassisRef: 'mule', currentHeat: 2 }, null))
    )
    expect(mech).toContain('**Structure Points** —')
    expect(mech).toContain('**Heat** 2')
  })

  test('vitals tagged for the other kind are not read', () => {
    // `kind` is what narrows the payload, never the table alone.
    const text = cardText(sheetCard(sheet('pilots', { callsign: 'Rook' }, MULE_VITALS)))
    expect(text).toContain('**Hit Points** —')
  })
})

describe('denialMessage', () => {
  test('an unlinked user is told there is nothing to link', () => {
    const message = denialMessage('unlinked')
    // The whole point of Discord-as-sole-provider: signing in IS the linking
    // step, so the message must not imply a code to paste.
    expect(message).toContain('nothing to copy across')
    expect(message).toContain(`${WEB}/account`)
  })

  test('every reason produces a non-empty message', () => {
    for (const reason of ['unlinked', 'not-found'] as const) {
      expect(denialMessage(reason).length).toBeGreaterThan(0)
    }
  })
})

describe('deep links', () => {
  test('a game links to its own route, not a query string', () => {
    // /games/$gameId is the real TanStack route (games_/$gameId.tsx). A link
    // that 404s reads as the app having lost the game, not as the bot guessing.
    expect(gameUrl('g1')).toBe(`${WEB}/games/g1`)
  })

  test('every sheet links to the live sheet by its row id', () => {
    // /sheet/$kind/$id resolves a Convex row id for anyone allowed to see the
    // row (The Cantina's entities.locate), so one shape serves the owner and the crew.
    expect(sheetUrl('pilots', 'cx-p1')).toBe(`${WEB}/sheet/pilot/cx-p1`)
    expect(sheetUrl('mechs', 'cx-m1')).toBe(`${WEB}/sheet/mech/cx-m1`)
    expect(sheetUrl('crawlers', 'cx-c1')).toBe(`${WEB}/sheet/crawler/cx-c1`)
  })

  test('a sheet with no row id has no link at all', () => {
    expect(sheetUrl('pilots', '')).toBeNull()
    expect(sheetUrl('pilots', null)).toBeNull()
    expect(sheetUrl('pilots', undefined)).toBeNull()
  })
})

describe('gamesCard', () => {
  test('an empty game list is stated, not implied', () => {
    expect(cardText(gamesCard([]))).toContain('No Games yet')
  })

  test('links to the Hangar, since the Cantina has no /games page', () => {
    expect(cardUrl(gamesCard([]))).toBe(`${WEB}/`)
  })

  test('roles read as base role plus modifier, never as three roles', () => {
    const card = gamesCard([{ gameId: 'g1', name: 'Tenacity', mediator: true, organizer: true }])
    // ADR-030 §3: Organizer is a flag ON a base role, so it renders alongside
    // Mediator rather than replacing it.
    expect(cardText(card)).toContain('Mediator · Organiser')
  })
})
