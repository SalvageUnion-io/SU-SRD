import { describe, expect, test } from 'bun:test'
import { AUTHORED_LEADS } from 'salvageunion-reference/proseDeviations'
import { ruling } from '../lib/proseRuling'

const prose = (file: string, entityName: string, text: string) =>
  ({ kind: 'prose', file, entityName, text }) as const

describe('ruling', () => {
  test('a printed-name ruling, bare or with its owner suffix', () => {
    const name = { kind: 'name', file: 'modules.json', entityName: 'x' } as const
    expect(ruling({ ...name, text: 'Video Projection Array' }, 1)).toEqual({
      verdict: 'deviation',
      reason: 'printed-name',
    })
    expect(ruling({ ...name, text: 'Video Projection Array (Owner)' }, 1)?.reason).toBe(
      'printed-name'
    )
    // A name is never boilerplate, however often it repeats.
    expect(ruling({ ...name, text: 'Choose one.' }, 9)).toBeUndefined()
  })

  test('an authored lead only on its own roll table, with its own text', () => {
    const lead = AUTHORED_LEADS[0]
    if (!lead) throw new Error('fixture missing: an authored lead')
    expect(ruling(prose('roll-tables.json', lead.name, lead.text), 1)).toEqual({
      verdict: 'authored',
      reason: 'authored-lead',
    })
    expect(ruling(prose('roll-tables.json', 'Core Mechanic', lead.text), 1)).toBeUndefined()
    expect(ruling(prose('systems.json', lead.name, lead.text), 1)).toBeUndefined()
    expect(ruling(prose('roll-tables.json', lead.name, `${lead.text} More.`), 1)).toBeUndefined()
  })

  test('boilerplate from three repeats', () => {
    expect(ruling(prose('npcs.json', 'x', 'Choose one.'), 3)?.reason).toBe('boilerplate')
    expect(ruling(prose('npcs.json', 'x', 'Choose one.'), 2)).toBeUndefined()
  })
})
