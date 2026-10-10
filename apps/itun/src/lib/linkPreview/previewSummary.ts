/**
 * What a player thing's link preview says (issue 1280, board PV1), in words.
 *
 * One pure module, read twice: by the Worker, which writes the unfurl's
 * `og:*` and `theme-color` into the shell for a crawler, and by the
 * `/og/$kind/$id` render surface, which draws the same words on `OgCard`
 * with the stats beside them. So the text beside an unfurl's image and the
 * text on it cannot disagree. It imports no reference data (the Worker must
 * stay small): a slug becomes a name through the `names` the caller passes,
 * the reference itself in the browser and a plain title-casing in the Worker.
 *
 * Nothing here is private. The answers it reads come from
 * `publicSheet.preview` and `publicSheet.invitePreview`, which serve only what
 * anyone with the link may read; a null answer becomes the plain private card.
 */
import type { OgCardProps } from 'component-lib'
import { color } from 'component-lib/design/tokens'

/** The kinds of player thing a link previews. */
export type PreviewKind = 'pilot' | 'mech' | 'crawler' | 'pattern'

export const PREVIEW_KINDS: readonly PreviewKind[] = ['pilot', 'mech', 'crawler', 'pattern']

export function isPreviewKind(value: string): value is PreviewKind {
  return (PREVIEW_KINDS as readonly string[]).includes(value)
}

/** `publicSheet.preview`'s answer. */
export type PreviewAnswer = {
  kind: PreviewKind
  body: unknown
  ownerName: string | null
  gameName: string | null
}

/** `publicSheet.invitePreview`'s answer. */
export type InvitePreviewAnswer = {
  gameName: string
  mediatedBy: string | null
  role: 'player' | 'mediator'
  requiresApproval: boolean
  expiresAt: number
}

/** Names a reference slug: a class, a chassis, a crawler type. */
export type NameOf = (schema: 'classes' | 'chassis' | 'crawlers', slug: string) => string

/** A slug as words, for a caller with no reference data: `mech-tech` → `Mech Tech`. */
export const titleCaseSlug: NameOf = (_schema, slug) =>
  slug
    .split('-')
    .filter((word) => word.length > 0)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')

/**
 * The card a preview draws, minus what only the page can work out (the stats)
 * and where it lives (the address). The stats start empty; the render surface
 * fills them from the reference.
 */
export type PreviewCard = Exclude<OgCardProps, { kind: 'thing' } | { kind: 'do' }>

/** The plain card for anything set to Only me, or not there at all. */
export function privateCard(address: string): PreviewCard {
  return { kind: 'private', address }
}

function text(body: unknown, key: string): string | undefined {
  const value = (body as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => !!part && part.length > 0).join(' · ')
}

/** "Rosa's pilot", or the plain kind when nobody owns it. */
function owned(owner: string | null, noun: string): string {
  return owner ? `${owner}'s ${noun}` : `A ${noun}`
}

/** A player thing's card, from its public answer. */
export function sheetCard(answer: PreviewAnswer, nameOf: NameOf, address: string): PreviewCard {
  const { body, ownerName, gameName } = answer
  switch (answer.kind) {
    case 'pilot': {
      const classRef = text(body, 'classRef')
      return {
        kind: 'sheet',
        kicker: joinParts(['Pilot', classRef ? nameOf('classes', classRef) : undefined]),
        title: text(body, 'callsign') ?? text(body, 'name') ?? 'Pilot',
        tone: color.pilot,
        stats: [],
        byline: joinParts([owned(ownerName, 'pilot'), gameName]),
        address,
      }
    }
    case 'mech': {
      const chassisRef = text(body, 'chassisRef')
      return {
        kind: 'sheet',
        kicker: joinParts(['Mech', chassisRef ? nameOf('chassis', chassisRef) : undefined]),
        title: text(body, 'name') ?? 'Mech',
        tone: color.mech,
        stats: [],
        byline: joinParts([owned(ownerName, 'mech'), gameName]),
        address,
      }
    }
    case 'crawler': {
      const type = text(body, 'type')
      return {
        kind: 'sheet',
        kicker: joinParts(['Union Crawler', type ? nameOf('crawlers', type) : undefined]),
        title: text(body, 'name') ?? 'Union Crawler',
        tone: color.crawler,
        stats: [],
        // A Game's crawler is the crew's home, owned by nobody: the Game names it.
        byline: gameName ? joinParts(['Crew crawler', gameName]) : owned(ownerName, 'crawler'),
        address,
      }
    }
    case 'pattern': {
      const chassisRef = text(body, 'chassisRef')
      return {
        kind: 'userMade',
        kicker: joinParts(['Mech Pattern', chassisRef ? nameOf('chassis', chassisRef) : undefined]),
        title: text(body, 'name') ?? 'Mech Pattern',
        tone: color.mech,
        stats: [],
        madeBy: ownerName ?? 'a player',
        address,
      }
    }
  }
}

/** "15 Oct": the expiry as a player reads it, in UTC so every renderer agrees. */
export function expiryDate(expiresAt: number): string {
  return new Date(expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** A Game invite's card: the Game, who mediates and the expiry, never the code. */
export function inviteCard(answer: InvitePreviewAnswer, address: string): PreviewCard {
  const seat = answer.role === 'mediator' ? 'Mediator seat' : 'Player seat'
  return {
    kind: 'invite',
    kicker: `You're invited · ${seat}`,
    title: answer.gameName,
    tone: color.crawler,
    summary: answer.mediatedBy
      ? `Mediated by ${answer.mediatedBy}.`
      : `A Salvage Union Game on ITUN.`,
    terms: joinParts([
      `Link expires ${expiryDate(answer.expiresAt)}`,
      answer.requiresApproval ? 'the Mediator lets you in' : undefined,
    ]),
    address,
  }
}

/**
 * The words an unfurl carries, from the same card the image draws: `og:title`
 * is the name and `og:description` the kicker and byline, never the body;
 * `theme-color` is the band's tone. `OgCard`'s `ogCardTitle`,
 * `ogCardDescription` and `ogCardThemeColor` say the same of the drawn card
 * (`previewSummary.test.ts` holds them equal); this copy exists so the Worker
 * does not bundle the component.
 */
export function previewWords(card: PreviewCard): {
  title: string
  description: string
  themeColor: string
} {
  switch (card.kind) {
    case 'private':
      return {
        title: 'Private',
        description: "Its owner hasn't shared this.",
        themeColor: color.inkDeep,
      }
    case 'sheet':
      return {
        title: card.title,
        description: joinParts([card.kicker, card.byline]),
        themeColor: card.tone,
      }
    case 'userMade':
      return {
        title: card.title,
        description: joinParts([card.kicker, `Made by ${card.madeBy}`]),
        themeColor: card.tone,
      }
    case 'invite':
      return {
        title: card.title,
        description: joinParts([card.kicker, card.summary]),
        themeColor: card.tone,
      }
  }
}
