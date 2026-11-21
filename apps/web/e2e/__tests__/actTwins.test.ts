/**
 * The act-twin check (`_hierarchy.ts`, ruleset §3.14) on hand-made acts: an
 * act in one variant everywhere passes; the same words, or two `+ New…`
 * makes, in two variants fail, naming where each look first stood.
 */
import { describe, expect, test } from 'bun:test'
import type { Act } from '../_hierarchy'
import { actTwins } from '../_hierarchy'

const act = (words: string, variant: string, where: string): Act => ({
  act: words,
  variant,
  family: 'build',
  where,
})

describe('act-twin (§3.14)', () => {
  test('one act in one variant on every page passes', () => {
    expect(
      actTwins([act('+ New…', 'default', '/build/'), act('+ New…', 'default', '/games/x/')])
    ).toEqual([])
  })

  test('an act in two variants fails once per extra look, naming both places', () => {
    const faults = actTwins([
      act('pay', 'default', ':crawler read'),
      act('pay', 'primary', ':crawler edit'),
      act('pay', 'primary', ':crawler phone'),
    ])
    expect(faults.map((f) => f.line)).toEqual([
      'act-twin: "pay" primary at :crawler edit, default at :crawler read',
    ])
  })

  test('different acts never twin', () => {
    expect(actTwins([act('share', 'default', '/'), act('play', 'primary', '/')])).toEqual([])
  })
})
