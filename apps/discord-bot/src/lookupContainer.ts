/**
 * `/su lookup` as a Components V2 container.
 *
 * ## Why this is an adapter, not a rewrite
 *
 * `lookupEmbed.ts` is the most carefully-tested surface the bot has: it linkifies
 * trait references, resolves slugs to printed names, renders patterns and
 * columns tables, and `lookupEmbed.test.ts` asserts that **every entity in every
 * non-meta schema** yields a Discord-valid embed. Rewriting that to emit blocks
 * directly would put all of it at risk to change a presentation layer.
 *
 * So the builder keeps producing a `LookupEmbed`, and this maps that to blocks.
 * The content rules stay where they are tested; only the rendering moves.
 *
 * ## What the move buys
 *
 * A thumbnail. `LookupEmbed` has no thumbnail slot, so `/su lookup` rendered no
 * artwork at all — for any of the ~57 entities across `classes`, `chassis`,
 * `bio-titans`, `creatures`, `drones`, `meld`, `npcs` and `vehicles` that have
 * it. A V2 section carries a thumbnail accessory beside one block of text
 * rather than narrowing the whole column, which is exactly the shape wanted.
 *
 * ## Two mappings that are not one-to-one
 *
 * A container has no title slot and no footer slot, so:
 *
 * - **The title becomes a masked link** in a `##` heading. Masked links do not
 *   render in plain message content but do in a TextDisplay, which is what
 *   makes this work — and it is why the title's URL survives the move rather
 *   than being dropped.
 * - **The footer becomes a `-#` line**, keeping the same
 *   `<source> · p.N · Salvage Union Reference` grammar it already had.
 */

import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { getAssetUrl } from 'salvageunion-reference'
import type { ContainerBlock, ContainerData } from './container.js'
import type { LookupEmbed } from './lookupEmbed.js'

/**
 * A field rendered as a block.
 *
 * An embed lays inline fields out in columns; a container has no columns, so an
 * inline field becomes `**Name** value` on one line and a full-width field
 * becomes a bolded heading with its value beneath. That keeps short label/value
 * pairs compact without pretending the column layout survived.
 */
function fieldBlock(field: { name: string; value: string; inline?: boolean }): ContainerBlock {
  return {
    kind: 'text',
    content:
      field.inline === true
        ? `**${field.name}** ${field.value}`
        : `**${field.name}**\n${field.value}`,
  }
}

/** The artwork URL for an entity, or undefined when it has none. */
export function artworkFor(entity: SURefEntity): string | undefined {
  return getAssetUrl(entity)
}

/**
 * Map a built `LookupEmbed` onto container blocks.
 *
 * `entity` is taken separately only to resolve artwork — the embed data itself
 * carries no image, because an embed builder here never had a slot for one.
 */
export function lookupContainerData(
  data: LookupEmbed,
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
): ContainerData {
  const heading = data.url ? `## [${data.title}](${data.url})` : `## ${data.title}`
  const artwork = artworkFor(entity)

  const blocks: ContainerBlock[] = []

  // With artwork, the heading and the opening prose sit in a section so the
  // image can hang beside them. Without it, they are ordinary blocks — an
  // empty section would render as a narrowed column with nothing in the gutter.
  if (artwork !== undefined) {
    const section: ContainerBlock = {
      kind: 'section',
      text: data.description ? [heading, data.description] : [heading],
      thumbnail: { url: artwork, description: data.title },
    }
    blocks.push(section)
  } else {
    blocks.push({ kind: 'text', content: heading })
    if (data.description) blocks.push({ kind: 'text', content: data.description })
  }

  for (const field of data.fields) blocks.push(fieldBlock(field))

  blocks.push({ kind: 'separator' })
  blocks.push({ kind: 'text', content: `-# ${data.footer}` })

  return { accent: data.color, blocks }
}
