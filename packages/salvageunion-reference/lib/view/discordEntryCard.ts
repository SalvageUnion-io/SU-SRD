/**
 * An entry's ONE Discord card: what the bot's `/su lookup` sends and what the
 * SRD's Component Embed draws when someone pastes the entry's link. Both call
 * `discordEntryCard`, so the two are the same blocks, shed to the same budget
 * (`docs/ARCHITECTURE.md#discord-bot`).
 *
 * The budget is the tighter of the two surfaces: Discord's 3,000 bytes for a
 * Component Embed's JSON, measured as the SRD serves it (`<` escaped). A card
 * that fits it is also well inside a bot message's 4,000 characters of text, so
 * the bot never sheds a part the pasted link keeps, or keeps one it sheds.
 *
 * A pattern's card (a chassis or Bio-Titan pattern) is the same card for its
 * own page and its own lookup: patterns are entries in their own right, never
 * listed on their host's card.
 */

import { SRD_SITE_URL } from '../assets'
import type { SURefMetaEntity, SURefObjectAnyPattern } from '../schemas/index'
import type { DiscordBlock, DiscordCard } from './discordCard'
import { discordAccent, discordCard, discordCardParts } from './discordCard'
import { toEntityModel } from './toEntityModel'

/** Discord's ceiling for a Component Embed's whole payload, in UTF-8 bytes. */
export const COMPONENT_EMBED_MAX_BYTES = 3000

/** Discord's component type ids (Components V2). */
const TYPE = { section: 9, text: 10, thumbnail: 11, separator: 14, container: 17 } as const

function toRaw(block: DiscordBlock): Record<string, unknown> {
  switch (block.kind) {
    case 'text':
      return { type: TYPE.text, content: block.content }
    case 'separator':
      return { type: TYPE.separator, divider: true, spacing: 1 }
    case 'section':
      return {
        type: TYPE.section,
        components: block.text.map((content) => ({ type: TYPE.text, content })),
        ...(block.thumbnail
          ? {
              accessory: {
                type: TYPE.thumbnail,
                media: { url: block.thumbnail.url },
                description: block.thumbnail.description,
              },
            }
          : {}),
      }
  }
}

/** A card as a Component Embed's JSON: one Container, its accent the card's tone. */
export function componentEmbedJson(card: DiscordCard): string {
  return JSON.stringify({
    component: {
      type: TYPE.container,
      accent_color: discordAccent(card.tone),
      components: card.blocks.map(toRaw),
    },
  })
}

/**
 * A Component Embed's size as served: the SRD escapes each `<` in the JSON as
 * `<` before it goes in the page's `<script>`, which adds five bytes each.
 */
export function componentEmbedBytes(json: string): number {
  const escapes = json.split('<').length - 1
  return new TextEncoder().encode(json).length + escapes * 5
}

/** Whether a card fits the one budget both surfaces share. */
function fitsDiscordEntryBudget(card: DiscordCard): boolean {
  return componentEmbedBytes(componentEmbedJson(card)) <= COMPONENT_EMBED_MAX_BYTES
}

/**
 * A card with every SRD link moved from {@link SRD_SITE_URL} to `origin`: the
 * SRD's own Component Embed on a Worker Preview links that Preview. Only the
 * prose carries SRD links; a thumbnail is artwork on the asset host, which
 * this prefix cannot match.
 */
function withSrdOrigin(card: DiscordCard, origin: string): DiscordCard {
  const from = `${SRD_SITE_URL}/`
  // Trailing slashes trimmed by a scan, not `/\/+$/`: that regex backtracks
  // quadratically on a run of slashes (CodeQL js/polynomial-redos).
  let end = origin.length
  while (end > 0 && origin[end - 1] === '/') end--
  const to = `${origin.slice(0, end)}/`
  const rebase = (text: string) => text.replaceAll(from, to)
  return {
    ...card,
    blocks: card.blocks.map((block) => {
      switch (block.kind) {
        case 'text':
          return { ...block, content: rebase(block.content) }
        case 'section':
          return { ...block, text: block.text.map(rebase) }
        default:
          return block
      }
    }),
  }
}

/** Where an entry card's SRD links point; production's site unless given. */
type DiscordEntryCardOptions = {
  /** The SRD origin to link, without a trailing slash: a Worker Preview's, say. */
  srdOrigin?: string
}

/**
 * An entry's (or one of its patterns') Discord card, shed to the shared budget.
 * With `srdOrigin`, its links point there, and the budget is measured on those
 * links, since a longer origin can shed a part production's keeps.
 */
export function discordEntryCard(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern,
  options: DiscordEntryCardOptions = {}
): DiscordCard {
  const parts = discordCardParts(
    toEntityModel(entity, undefined, pattern ? { pattern } : undefined)
  )
  const { srdOrigin } = options
  if (srdOrigin === undefined || srdOrigin === SRD_SITE_URL) {
    return discordCard(parts, { fits: fitsDiscordEntryBudget })
  }
  const rebase = (card: DiscordCard) => withSrdOrigin(card, srdOrigin)
  return rebase(discordCard(parts, { fits: (card) => fitsDiscordEntryBudget(rebase(card)) }))
}
