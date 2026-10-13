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

/** An entry's (or one of its patterns') Discord card, shed to the shared budget. */
export function discordEntryCard(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): DiscordCard {
  const parts = discordCardParts(
    toEntityModel(entity, undefined, pattern ? { pattern } : undefined)
  )
  return discordCard(parts, { fits: fitsDiscordEntryBudget })
}

/**
 * The bot's index card for a long entry: the same card, its actions drawn as
 * index rows (name and stat line) that the bot hangs Read buttons on. Only the
 * bot draws it, since a Component Embed cannot carry a button; it is held to
 * the same budget, so it never sheds what the entry card keeps.
 */
export function discordEntryIndexCard(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): DiscordCard {
  const parts = discordCardParts(
    toEntityModel(entity, undefined, pattern ? { pattern } : undefined)
  )
  return discordCard(parts, { fits: fitsDiscordEntryBudget, indexActions: true })
}
