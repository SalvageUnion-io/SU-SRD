import { describe, expect, test } from 'bun:test'
import { ogCardDescription, ogCardThemeColor, ogCardTitle } from 'component-lib'
import { color } from 'component-lib/design/tokens'
import { fullSheetCard, previewStats, referenceName } from '../previewStats'
import type { InvitePreviewAnswer, PreviewAnswer, PreviewCard } from '../previewSummary'
import {
  expiryDate,
  inviteCard,
  previewWords,
  privateCard,
  sheetCard,
  titleCaseSlug,
} from '../previewSummary'

/**
 * A player thing's link preview in words (issue 1280): what the Worker writes
 * beside the unfurl and what the card draws must be the same words.
 */

const PILOT: PreviewAnswer = {
  kind: 'pilot',
  body: { name: 'Rosa Vance', callsign: 'Bonesaw', classRef: 'engineer', currentHP: 8 },
  ownerName: 'Rosa',
  gameName: 'Reclamation of the Wastes',
}

const MECH: PreviewAnswer = {
  kind: 'mech',
  body: { name: 'Gravedigger', chassisRef: 'scrapper', currentSP: 4 },
  ownerName: 'Rosa',
  gameName: null,
}

const CRAWLER: PreviewAnswer = {
  kind: 'crawler',
  body: { name: 'Tenacity', type: 'augmented', techLevel: '2' },
  ownerName: null,
  gameName: 'Reclamation of the Wastes',
}

const PATTERN: PreviewAnswer = {
  kind: 'pattern',
  body: { name: 'Tow Rig', chassisRef: 'scrapper', systems: [], modules: [] },
  ownerName: 'alxjrvs',
  gameName: null,
}

const INVITE: InvitePreviewAnswer = {
  gameName: 'Reclamation of the Wastes',
  mediatedBy: 'alxjrvs',
  role: 'player',
  requiresApproval: true,
  expiresAt: Date.UTC(2026, 9, 15, 12),
}

const ADDRESS = 'intheunionnow.com/p/pilot/p-1'

const CARDS: [string, PreviewCard][] = [
  ['pilot', fullSheetCard(PILOT, ADDRESS)],
  ['mech', fullSheetCard(MECH, ADDRESS)],
  ['crawler', fullSheetCard(CRAWLER, ADDRESS)],
  ['pattern', fullSheetCard(PATTERN, ADDRESS)],
  ['invite', inviteCard(INVITE, 'intheunionnow.com')],
  ['private', privateCard('intheunionnow.com')],
]

describe('the words beside the image are the words on it', () => {
  for (const [name, card] of CARDS) {
    test(name, () => {
      const words = previewWords(card)
      expect(words.title).toBe(ogCardTitle(card))
      expect(words.description).toBe(ogCardDescription(card))
      expect(words.themeColor).toBe(ogCardThemeColor(card))
    })
  }
})

describe('sheetCard', () => {
  test('a pilot: callsign, class, the player and the Game', () => {
    const card = sheetCard(PILOT, titleCaseSlug, ADDRESS)
    expect(card).toMatchObject({
      kind: 'sheet',
      title: 'Bonesaw',
      kicker: 'Pilot · Engineer',
      byline: "Rosa's pilot · Reclamation of the Wastes",
      tone: color.pilot,
    })
  })

  test("a Game's crawler is named by its Game", () => {
    expect(sheetCard(CRAWLER, titleCaseSlug, ADDRESS)).toMatchObject({
      byline: 'Crew crawler · Reclamation of the Wastes',
      tone: color.crawler,
    })
  })

  test('a pattern is user-made, credited only "Made by"', () => {
    expect(sheetCard(PATTERN, titleCaseSlug, ADDRESS)).toMatchObject({
      kind: 'userMade',
      kicker: 'Mech Pattern · Scrapper',
      madeBy: 'alxjrvs',
    })
  })

  test('an unclaimed sheet says so plainly', () => {
    expect(sheetCard({ ...MECH, ownerName: null }, titleCaseSlug, ADDRESS)).toMatchObject({
      byline: 'A mech',
    })
  })
})

describe('inviteCard', () => {
  test('the Game, its Mediator and the expiry', () => {
    expect(inviteCard(INVITE, 'intheunionnow.com')).toMatchObject({
      kind: 'invite',
      title: 'Reclamation of the Wastes',
      kicker: "You're invited · Player seat",
      summary: 'Mediated by alxjrvs.',
      terms: 'Link expires 15 Oct · the Mediator lets you in',
    })
    expect(expiryDate(INVITE.expiresAt)).toBe('15 Oct')
  })
})

describe('previewStats', () => {
  test('a pilot reads its pools as the sheet does', () => {
    const stats = previewStats(PILOT)
    expect(stats.map((s) => s.label)).toEqual(['HP', 'AP', 'TP'])
    expect(stats[0]?.value).toMatch(/^8\/\d+$/)
  })

  test('a pattern reads its chassis: TL, slots and SP', () => {
    expect(previewStats(PATTERN).map((s) => s.label)).toEqual(['TL', 'SYS', 'MODS', 'SP'])
    expect(previewStats({ ...PATTERN, body: { chassisRef: 'no-such' } })).toEqual([])
  })

  test('a mech and a crawler read their structure', () => {
    expect(previewStats(MECH).map((s) => s.label)).toEqual(['SP', 'EP', 'Heat'])
    expect(previewStats(CRAWLER).map((s) => s.label)).toEqual(['TL', 'SP'])
  })

  test('names come from the reference, and fall back to words', () => {
    expect(referenceName('chassis', 'scrapper')).toBe('Scrapper')
    expect(referenceName('classes', 'no-such-class')).toBe('No Such Class')
  })
})
