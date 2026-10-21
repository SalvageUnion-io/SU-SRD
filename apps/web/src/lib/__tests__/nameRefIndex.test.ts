/**
 * The SRD's name index over the whole dataset, and the gate on it: every term
 * the rules text tags with its kind's noun ("the Dependable Trait", "the
 * Critical Damage Table", "Close Range") links, but the few below, which name
 * nothing the SRD has a page for.
 */
import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { nameRefIndex, parseTraitReferences } from 'salvageunion-reference'
import { findNameRefs } from '../../components/index'
import { getEntitySchemas, SalvageUnionReference } from '../gameData'
import { nameRefIndexWithout, nameRefsFor } from '../nameRefIndex'

/**
 * Terms the book tags with a noun that name no entry, each with why. A new
 * one fails the gate: link it (a name the index should hold) or list it here.
 */
const UNLINKED: Record<string, string> = {
  'Ferrous Range': 'a mountain range, not a distance',
  'Anomaly Table': 'printed in an adventure; the SRD has no such table',
  'A.I. Personality Trait Table': "the book's other name for the A.I. Personality Table",
  'Climb Trait': 'the book misprints the Climbing Trait',
}

/** The rules text of a record: its paragraphs, descriptions and table results. */
function prose(value: unknown, into: string[] = [], key = ''): string[] {
  if (typeof value === 'string') {
    if (['value', 'description', 'effect', 'text', 'notes'].includes(key)) into.push(value)
  } else if (Array.isArray(value)) for (const item of value) prose(item, into, key)
  else if (value && typeof value === 'object') {
    for (const [k, item] of Object.entries(value)) prose(item, into, k)
  }
  return into
}

function entities(): RefEntity[] {
  return getEntitySchemas().flatMap(
    (schema) => SalvageUnionReference.findAllIn(schema.id as never, () => true) as RefEntity[]
  )
}

const TAGGED = /((?:[A-Z][\w'.-]*)(?: (?:[A-Z][\w'.-]*|of|the))*) (?:Traits?|Table|Range)\b/g
const DETERMINER = /^(?:(?:The|This|That|These|Its|A|An|Any|Each) )+/

describe('nameRefIndex', () => {
  test("links the Dependable Chassis's trait, table and keyword", () => {
    const text =
      'This Chassis gains the Dependable Trait. Additionally, you may re-roll results on the Critical Damage Table and on failed Heat Checks.'
    expect(
      findNameRefs(text, nameRefIndex().index).map((m) => [m.ref.schemaName, m.ref.name])
    ).toEqual([
      ['traits', 'dependable'],
      ['roll-tables', 'Critical Damage'],
      ['keywords', 'heat check'],
    ])
  })

  test('no two entries of one kind share a name', () => {
    expect([...nameRefIndex().ambiguous.keys()]).toEqual([])
  })

  test("an entity's index drops its own name, keeping a namesake that needs its noun", () => {
    const bay = SalvageUnionReference.findAllIn('crawler-bays', (b) => b.name === 'Trading Bay')[0]
    if (!bay) throw new Error('fixture missing: Trading Bay')
    const own = nameRefIndexWithout(bay.id)['trading bay']
    expect(own?.map((c) => [c.ref.schemaName, c.needsNoun])).toEqual([['roll-tables', true]])
  })

  test("an island's index holds just the names its prose uses", () => {
    const trooper = SalvageUnionReference.findAllIn('chassis', (c) => c.name === 'Trooper')[0]
    if (!trooper) throw new Error('fixture missing: Trooper')
    // Its chassis ability is drawn by the card, not held in its record.
    const keys = Object.keys(
      nameRefsFor(trooper, ['This Chassis gains the Dependable Trait.']) ?? {}
    )
    expect(keys).toContain('dependable')
    expect(keys).toContain('k4 rifle')
    expect(keys.length).toBeLessThan(40)
  })

  test('GATE: every term the rules text tags with its noun links', () => {
    const missed = new Map<string, string>()
    const seen = new Set<string>()
    for (const entity of entities()) {
      const index = nameRefIndexWithout(entity.id)
      for (const text of prose(entity)) {
        const traits = parseTraitReferences(text).map((r) => ({
          start: r.startIndex,
          end: r.startIndex + r.fullMatch.length,
        }))
        const found = findNameRefs(text, index, traits)
        const names = new Set(found.map((m) => m.ref.name.toLowerCase()))
        for (const tagged of text.matchAll(TAGGED)) {
          const start = tagged.index
          const end = start + tagged[0].length
          if (traits.some((span) => start < span.end && end > span.start)) continue
          if (found.some((m) => m.start >= start && m.end <= end)) continue
          const name = `${tagged[1]} `.replace(DETERMINER, '').trim()
          const phrase = tagged[0].replace(DETERMINER, '').replace(/s$/, '')
          const own = entity.name.toLowerCase()
          // A bare noun ("This Trait"), a name linked earlier in the same text
          // (once per text), or the page's own name.
          if (!name || names.has(name.toLowerCase())) continue
          if (name.toLowerCase() === own || phrase.toLowerCase() === own) continue
          if (name.toLowerCase().startsWith(`${own} `)) continue
          if (phrase in UNLINKED) {
            seen.add(phrase)
            continue
          }
          missed.set(phrase, `${entity.name}: …${text.slice(Math.max(0, start - 40), end)}`)
        }
      }
    }
    expect(Object.fromEntries(missed)).toEqual({})
    // A listed term the text no longer prints comes off the list.
    expect([...seen].sort()).toEqual(Object.keys(UNLINKED).sort())
  })
})
