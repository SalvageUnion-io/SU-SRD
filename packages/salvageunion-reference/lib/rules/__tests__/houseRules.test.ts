import { describe, expect, it } from 'bun:test'
import { pilotMaxAPParts, pilotMaxHPParts } from '../derivedStats'
import { HOUSE_RULES } from '../houseRules'

describe('the house-rule registry', () => {
  it('gives every entry a unique id', () => {
    const ids = HOUSE_RULES.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cites the book by page for every entry', () => {
    for (const rule of HOUSE_RULES) expect(rule.cite).toMatch(/\bpp?\. \d/)
  })

  it('registers every house rule a stat line is tagged with', () => {
    const ids = new Set(HOUSE_RULES.map((rule) => rule.id))
    const tagged = [
      ...pilotMaxHPParts({ crawlerTechLevel: 6 }).sources,
      ...pilotMaxAPParts({ crawlerTechLevel: 6 }).sources,
    ].flatMap((source) => (source.houseRule ? [source.houseRule] : []))
    expect(tagged.length).toBeGreaterThan(0)
    for (const id of tagged) expect(ids.has(id)).toBe(true)
  })
})
