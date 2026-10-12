/**
 * Each entity page's DISCORD COMPONENT EMBED: the container Discord draws in
 * place of a link preview when someone pastes the page's URL. It is the card
 * the bot's `/su lookup` sends, block for block: both are `discordEntryCard`
 * (salvageunion-reference), shed to the one budget they share
 * (`docs/ARCHITECTURE.md#discord-bot`).
 *
 * Discord reads it from `<script id="discord:component-embed"
 * type="application/json">` in the head, without running any script: one
 * Container, at most 3,000 bytes, link buttons only. The OG tags stay the
 * fallback for every other unfurler.
 */

import type { SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { componentEmbedJson, discordEntryCard } from 'salvageunion-reference'

export { COMPONENT_EMBED_MAX_BYTES } from 'salvageunion-reference'

/** The embed's JSON for an entity, or one of its patterns on the pattern's own page. */
export function componentEmbedFor(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): string {
  return componentEmbedJson(discordEntryCard(entity, pattern))
}
