import type { ContainerData } from '../container.js'

/**
 * Read a built card the way Discord renders it, for assertions.
 *
 * Builders return `ContainerData`, so tests assert on the text that is sent
 * rather than on an intermediate shape nobody receives.
 */

/** Every text the card renders, in block order — section text included. */
export function cardTexts(data: ContainerData): string[] {
  return data.blocks.flatMap((block) => {
    if (block.kind === 'text') return [block.content]
    if (block.kind === 'section') return block.text
    return []
  })
}

/** The whole card as one string, for "does it mention X anywhere". */
export function cardText(data: ContainerData): string {
  return cardTexts(data).join('\n')
}

/** The `##` heading: the title, as a masked link when it has a URL. */
export function cardHeading(data: ContainerData): string {
  return cardTexts(data)[0] ?? ''
}

/** The URL the heading links to, or undefined when it is bare. */
export function cardUrl(data: ContainerData): string | undefined {
  return /^## \[.*\]\((.+)\)$/.exec(cardHeading(data))?.[1]
}

/**
 * The text block that starts with `prefix` — a full-width slab is
 * `**Name**\nvalue`, an inline run is `**Name** value` lines.
 */
export function blockStarting(data: ContainerData, prefix: string): string | undefined {
  return cardTexts(data).find((text) => text.startsWith(prefix))
}
