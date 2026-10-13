/**
 * "Look up in Salvage Union" — the message context menu. The finder matches
 * the names the book prints (and the row labels players quote), longest
 * first, and a single word only when it is capitalised as a game term.
 */
import { describe, expect, test } from 'bun:test'
import { MessageFlags } from 'discord-api-types/v10'
import { lookUpMessageCommand, lookUpMessageContainer } from '../commands/lookUpMessage'
import { findTerms } from '../termFinder'
import { cardText } from './cardText'
import { fakeExecute } from './fakeInteraction'

describe('findTerms', () => {
  test('finds a trait and a roll-table row a player quotes, in order', () => {
    const terms = findTerms(
      "took a Reactor Overheat last turn, so we're Vulnerable now?? what does that do"
    )
    expect(terms.map((t) => [t.hit.entity.name, t.matched, t.row])).toEqual([
      ['Reactor Overload', 'Reactor Overheat', '11-19'],
      ['vulnerable', 'Vulnerable', undefined],
    ])
  })

  test('the longest name wins', () => {
    expect(findTerms('my Mule just blew its Reactor Overload')[1]?.hit.entity.name).toBe(
      'Reactor Overload'
    )
  })

  test('an ordinary lower-case word is not a term', () => {
    expect(findTerms('take cover, it is hot out here')).toEqual([])
  })

  test('each entry once, at most five', () => {
    const terms = findTerms('Mule Mule Mule Goliath Vulnerable Hacking Scrapper Atlas Mule')
    expect(terms.length).toBeLessThanOrEqual(5)
    expect(new Set(terms.map((t) => t.hit.entity.id)).size).toBe(terms.length)
  })
})

describe('lookUpMessageContainer', () => {
  test('each term is a row that links its page and posts its card', () => {
    const data = lookUpMessageContainer("we're Vulnerable now", 'Rook')
    const text = cardText(data)
    expect(text).toContain("-# FOUND IN ROOK'S MESSAGE (1)")
    expect(text).toContain('### [Vulnerable](https://salvageunion.io/traits/vulnerable)')
    const row = data.blocks.find((block) => block.kind === 'section')
    expect(row?.kind === 'section' ? row.button?.label : undefined).toBe('Post to channel')
  })

  test('a message with no term says so', () => {
    expect(cardText(lookUpMessageContainer('lol ok'))).toContain('-# NOTHING FOUND IN THAT MESSAGE')
  })
})

describe('lookUpMessageCommand', () => {
  test('answers only the person who asked', async () => {
    const { interaction, replies } = fakeExecute({
      targetMessage: { content: 'the Mule is great', author: 'Rook' },
    })
    await lookUpMessageCommand.execute(interaction)
    expect(replies[0]?.flags).toBe(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  })
})
