/**
 * Each entity page's DISCORD COMPONENT EMBED: the container Discord draws in
 * place of a link preview when someone pastes the page's URL. It is the same
 * card the bot's `/su lookup` sends (`discordCardParts`, from the entity model),
 * so a pasted link and a lookup read as one product. The design is
 * `docs/architecture/discord-bot-refresh.md`.
 *
 * Discord reads it from `<script id="discord:component-embed"
 * type="application/json">` in the head, without running any script: one
 * Container, at most 3,000 bytes, link buttons only. The OG tags stay the
 * fallback for every other unfurler.
 */

import type { DiscordBlock, SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { discordAccent, discordCard, discordCardParts, toEntityModel } from 'salvageunion-reference'
import { escapeJsonForScript } from './escapeJsonForScript'

/** Discord's ceiling for the whole embed payload, in UTF-8 bytes. */
export const COMPONENT_EMBED_MAX_BYTES = 3000

/** Discord's component type ids (Components V2). */
const TYPE = { section: 9, text: 10, thumbnail: 11, separator: 14, container: 17 } as const

type RawComponent = Record<string, unknown>

function toRaw(block: DiscordBlock): RawComponent {
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

function payload(tone: string, blocks: DiscordBlock[]): string {
  return JSON.stringify({
    component: {
      type: TYPE.container,
      accent_color: discordAccent(tone),
      components: blocks.map(toRaw),
    },
  })
}

/** Bytes as served: `BaseLayout` script-escapes the JSON, which can lengthen it. */
const servedBytes = (json: string): number =>
  new TextEncoder().encode(escapeJsonForScript(json)).length

/**
 * The embed's JSON for an entity (or one of its patterns), shed to fit the
 * byte budget: whole parts go first, and the card then links the full entry.
 * A pattern's loadout is its point, so it keeps its children; an entity's own
 * page lists those, so its embed drops them first anyway.
 */
export function componentEmbedFor(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): string {
  const parts = discordCardParts(
    toEntityModel(entity, undefined, pattern ? { pattern } : undefined)
  )
  const card = discordCard(parts, {
    fits: (candidate) =>
      servedBytes(payload(candidate.tone, candidate.blocks)) <= COMPONENT_EMBED_MAX_BYTES,
  })
  return payload(card.tone, card.blocks)
}
