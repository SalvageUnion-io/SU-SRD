/**
 * The ITUN Game surfaces — `/su sheet`, `/su crew`, `/su games`, `/su shelf`,
 * `/su me` and the `/su game` group — as Components V2 containers.
 *
 * ## An adapter, for the same reason `lookupContainer.ts` is one
 *
 * `gameEmbed.ts` derives maxima through `salvageunion-reference/rules`,
 * resolves stored slugs to the names the book prints, groups abilities by tree
 * to stay inside a field cap, and picks a per-sheet accent. All of that is
 * content, all of it is tested, and none of it is presentation. So the builders
 * keep returning `EmbedData` and this maps that onto blocks.
 *
 * ## The one thing an embed did better
 *
 * A sheet's vitals are genuinely columnar — `HP ██████░░░░ 6/10` beside AP
 * beside Heat — and inline embed fields laid them out in a real three-across
 * grid. A container has no columns.
 *
 * Rather than pretend otherwise, consecutive inline fields are **merged into
 * one text block, one per line**. On a phone that is what an embed's inline
 * fields collapsed to anyway; on desktop it trades a grid for a rail, which
 * suits a gauge better than a grid ever did — the bars align on their left
 * edge and read as one instrument.
 *
 * ## Why the thumbnail moves into a section
 *
 * `EmbedData.thumbnail` was a top-right image. A V2 section pins it beside a
 * specific block instead, so a sheet's portrait sits next to its identity band
 * rather than floating above the vitals.
 */

import type { ContainerBlock, ContainerData } from './container.js'
import type { EmbedData } from './gameEmbed.js'

/** A field pair rendered on one line: `**HP** ██████░░░░ 6/10`. */
function inlineLine(field: { name: string; value: string }): string {
  return `**${field.name}** ${field.value}`
}

/**
 * Group consecutive inline fields together, so a vitals rail renders as one
 * block of lines rather than as several separate ones with gaps between.
 */
function fieldBlocks(fields: EmbedData['fields']): ContainerBlock[] {
  const blocks: ContainerBlock[] = []
  let run: string[] = []

  const flush = (): void => {
    if (run.length > 0) {
      blocks.push({ kind: 'text', content: run.join('\n') })
      run = []
    }
  }

  for (const field of fields) {
    if (field.inline) {
      run.push(inlineLine(field))
      continue
    }
    flush()
    // A full-width field is a slab: its name is a heading, its value the body.
    blocks.push({ kind: 'text', content: `**${field.name}**\n${field.value}` })
  }
  flush()
  return blocks
}

/**
 * Map built `EmbedData` onto container blocks.
 *
 * Mirrors `toEmbed` in `itunReply.ts` — one choke point, so a new Game builder
 * cannot forget the conversion — but note the limit guard is **not** applied
 * here: `toContainer` enforces its own budget, which is a different one from
 * `EMBED_LIMIT` and must not be applied twice.
 */
export function gameContainerData(data: EmbedData): ContainerData {
  const heading = data.url ? `## [${data.title}](${data.url})` : `## ${data.title}`
  const blocks: ContainerBlock[] = []

  if (data.thumbnail !== undefined) {
    blocks.push({
      kind: 'section',
      text: data.description ? [heading, data.description] : [heading],
      thumbnail: { url: data.thumbnail, description: data.title },
    })
  } else {
    blocks.push({ kind: 'text', content: heading })
    if (data.description) blocks.push({ kind: 'text', content: data.description })
  }

  blocks.push(...fieldBlocks(data.fields))
  blocks.push({ kind: 'separator' })
  blocks.push({ kind: 'text', content: `-# ${data.footer}` })

  return { accent: data.color, blocks }
}
