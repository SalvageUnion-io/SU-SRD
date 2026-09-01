/**
 * The roll surface's content rules. These are the assertions that pin the
 * behaviour the redesign exists for — the headline never being "Roll: 14", and
 * the tier ramp never being applied to a table that has no tiers.
 */

import { describe, expect, test } from 'bun:test'
import type { SURefRollTable } from 'salvageunion-reference'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import { buildRollMessage } from '../commands/roll.js'
import type { ContainerData } from '../container.js'
import { NEUTRAL_EMBED_COLOR, ROLL_COLORS } from '../format.js'
import { buildRollContainerData, isTieredTable, rollTableUrl } from '../rollContainer.js'

// No preload here. `apps/discord-bot/bunfig.toml` preloads
// `../../test/reference-preload.ts`, which loads every schema once for the
// whole workspace — a per-file `preload('all')` is at best a no-op and at
// worst hides an ordering bug, which is why `test-hygiene.test.ts` bans it.

function table(name: string): SURefRollTable {
  const found = SalvageUnionReference.RollTables.getByName(name)
  if (!found) throw new Error(`no such table: ${name}`)
  return found
}

/** Build the container data for a fixed roll. */
function rollOf(name: string, roll: number, context = {}): ContainerData {
  const outcome = rollOnTable(table(name).table, () => roll)
  if (!outcome.success) throw new Error(`no entry for ${roll} on ${name}`)
  return buildRollContainerData(table(name), outcome, context)
}

function text(data: ContainerData): string {
  return data.blocks.map((b) => (b.kind === 'text' ? b.content : '')).join('\n')
}

function headline(data: ContainerData): string {
  return text(data)
    .split('\n')
    .find((line) => line.startsWith('## ')) as string
}

describe('the headline is never a bare die number', () => {
  // 76 of 96 tables carry no labels; the old builder titled all of them
  // `Roll: N`. Measured across every roll on every table, that was 78.7% of
  // all outcomes.
  test('no table produces a "Roll: N" headline on any roll', () => {
    for (const t of SalvageUnionReference.RollTables.all()) {
      for (let roll = 1; roll <= 20; roll++) {
        const outcome = rollOnTable(t.table, () => roll)
        if (!outcome.success) continue
        const line = headline(buildRollContainerData(t, outcome))
        expect(line).not.toContain('Roll:')
      }
    }
  })

  test('an unlabelled short value becomes the headline itself', () => {
    // Callsign entries are bare words with no label — previously the value was
    // the title only by accident of the columns branch, and flat tables put it
    // in the body under "Roll: 14".
    expect(headline(rollOf('Callsign Table', 1))).toContain('SPARKLES')
  })

  test('a labelled entry uses its label, and keeps the value as the body', () => {
    const data = rollOf('Critical Injury', 1)
    expect(headline(data)).toContain('FATAL INJURY')
    expect(text(data)).toContain('fatal injury')
  })

  test('a long unlabelled value stays in the body, headline keeps the plate', () => {
    const data = rollOf('Crawler Damage', 14)
    expect(headline(data)).toContain('▌14▐')
    expect(text(data)).toContain('inoperable and grounded')
  })
})

describe('tier gating', () => {
  test('monotone outcome ramps are tiered; enumerative tables are not', () => {
    expect(isTieredTable(table('Core Mechanic'))).toBe(true)
    expect(isTieredTable(table('Crawler Damage'))).toBe(true)
    expect(isTieredTable(table('Callsign Table'))).toBe(false)
  })

  test('a 1 on an untiered table is NOT cascade red', () => {
    // The old builder applied getColor() unconditionally, so rolling a 1 on the
    // Callsign Table painted the embed cascade red and implied "Sparkles" was a
    // catastrophe. It affected 21 tables.
    expect(rollOf('Callsign Table', 1).accent).toBe(NEUTRAL_EMBED_COLOR)
  })

  test('an untiered table gets no banner at either extreme', () => {
    expect(text(rollOf('Callsign Table', 1))).not.toContain('▓▒░')
    expect(text(rollOf('Callsign Table', 20))).not.toContain('█▓')
  })

  test('a tiered table still takes the ramp', () => {
    expect(rollOf('Core Mechanic', 20).accent).toBe(ROLL_COLORS.nailed)
    expect(rollOf('Core Mechanic', 1).accent).toBe(ROLL_COLORS.cascade)
    expect(rollOf('Core Mechanic', 14).accent).toBe(ROLL_COLORS.success)
  })
})

describe('the tier word is withheld outside the Core Mechanic', () => {
  test('the Core Mechanic names its band', () => {
    expect(headline(rollOf('Core Mechanic', 20))).toContain('NAILED IT')
    expect(headline(rollOf('Core Mechanic', 1))).toContain('CASCADE FAILURE')
  })

  test('an outcome table does not — "SUCCESS" over a grounded Crawler reads wrong', () => {
    const data = rollOf('Crawler Damage', 14)
    expect(data.accent).toBe(ROLL_COLORS.success)
    expect(headline(data)).not.toContain('SUCCESS')
  })
})

describe('banners mark the extremes only', () => {
  test('a natural 1 gets the sawtooth', () => {
    expect(text(rollOf('Core Mechanic', 1))).toContain('▓▒░▓▒░')
  })

  test('a natural 20 gets the swell', () => {
    expect(text(rollOf('Core Mechanic', 20))).toContain('█')
  })

  test.each([2, 5, 6, 10, 11, 19])('a %i gets no banner', (roll) => {
    const body = text(rollOf('Core Mechanic', roll))
    expect(body).not.toContain('▓▒░')
    expect(body).not.toContain('░░░░▒')
  })
})

describe('provenance', () => {
  test('cites the book — a page reference the embed never carried', () => {
    expect(text(rollOf('Crawler Damage', 14))).toContain('p.219')
  })

  test('names the die and the matched band', () => {
    expect(text(rollOf('Core Mechanic', 14))).toContain('d20 14 · band 11-19')
  })

  test('a columns roll reports both dice, and calls the second an entry not a band', () => {
    const body = text(rollOf('Callsign Table', 1))
    expect(body).toContain('two d20')
    expect(body).toContain('entry 1')
    expect(body).not.toContain('band')
  })
})

describe('context', () => {
  test('names the roller when given one', () => {
    expect(text(rollOf('Core Mechanic', 14, { roller: 'Vex Marrow' }))).toContain(
      'rolled by Vex Marrow'
    )
  })

  test('the Game signal is its own line, not appended to attribution boilerplate', () => {
    const body = text(rollOf('Core Mechanic', 14, { loggedTo: 'Tenacity' }))
    expect(body).toContain('█ LOGGED TO TENACITY')
  })

  test('no Game signal when the roll was not recorded', () => {
    expect(text(rollOf('Core Mechanic', 14))).not.toContain('LOGGED TO')
  })
})

test('the See table link resolves to the reference site, with no trailing slash', () => {
  const url = rollTableUrl(table('Core Mechanic'))
  expect(url).toBe('https://salvageunion.io/schema/roll-tables/item/core-mechanic')
})

describe('a dramatic table miss is a result, not an error', () => {
  // Blinding Blue Laser Rifle and Bio-Talon carry only a `20` key, so
  // resultForTable reports failure on 19 of every 20 rolls. The old builder
  // rendered its internal diagnostic — "No result found for roll 7" — to the
  // user as an error. That is not an error; it is what the book means.
  test.each([1, 7, 19])('a %i renders NO EFFECT publicly', (roll) => {
    const message = buildRollMessage('Bio-Talon', 'Vex Marrow', () => roll)
    if ('error' in message) throw new Error('a miss must not be an error')
    const body = message.data.blocks.map((b) => (b.kind === 'text' ? b.content : '')).join('\n')
    expect(body).toContain('NO EFFECT')
    expect(body).toContain('only triggers on a 20')
    expect(body).not.toContain('No result found')
    // A result, so it is public — no ephemeral flag.
    expect(message.ephemeral).toBeUndefined()
  })

  test('a 20 still rolls the real entry', () => {
    const message = buildRollMessage('Bio-Talon', 'Vex Marrow', () => 20)
    if ('error' in message) throw new Error('expected a roll')
    const body = message.data.blocks.map((b) => (b.kind === 'text' ? b.content : '')).join('\n')
    expect(body).not.toContain('NO EFFECT')
    expect(body).toContain('▌20▐')
  })
})
