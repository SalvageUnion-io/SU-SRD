import { describe, expect, it } from 'bun:test'
import { loadAllDataFiles } from '../loadData'
import { findTagIssuesInBlock, runPlayTagCheck } from '../validatePlayTagsLogic'

const VALUE = 'Make an attack. For example, hit a Mech. It deals 2 SP.'

describe('findTagIssuesInBlock', () => {
  it('passes a block without tags, a whole-block tag, and exact words', () => {
    expect(findTagIssuesInBlock({ value: VALUE })).toEqual([])
    expect(findTagIssuesInBlock({ value: VALUE, notInPlay: [{ role: 'flavor' }] })).toEqual([])
    expect(
      findTagIssuesInBlock({
        value: VALUE,
        notInPlay: [{ role: 'example', text: 'For example, hit a Mech.' }],
      })
    ).toEqual([])
  })

  it('fails words that are not in the value, or are in it twice', () => {
    expect(
      findTagIssuesInBlock({
        value: VALUE,
        notInPlay: [{ role: 'example', text: 'hit a Bio-Titan' }],
      })
    ).toHaveLength(1)
    expect(
      findTagIssuesInBlock({
        value: `${VALUE} ${VALUE}`,
        notInPlay: [{ role: 'example', text: 'For example' }],
      })
    ).toHaveLength(1)
  })

  it('fails a whole-block tag with a sibling, and overlapping tags', () => {
    expect(
      findTagIssuesInBlock({
        value: VALUE,
        notInPlay: [{ role: 'flavor' }, { role: 'example', text: 'For example' }],
      })
    ).toHaveLength(1)
    expect(
      findTagIssuesInBlock({
        value: VALUE,
        notInPlay: [
          { role: 'example', text: 'For example, hit' },
          { role: 'example', text: 'hit a Mech.' },
        ],
      })
    ).toEqual(['two tags overlap'])
  })

  it('fails a tag on a block whose value is not text', () => {
    expect(findTagIssuesInBlock({ value: [], notInPlay: [{ role: 'flavor' }] })).toHaveLength(1)
  })
})

describe('the data', () => {
  it('every Play tag names words its block holds exactly once', () => {
    expect(runPlayTagCheck(loadAllDataFiles())).toEqual([])
  })
})
