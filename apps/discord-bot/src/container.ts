/**
 * Components V2 plumbing — the `data → ContainerBuilder` seam.
 *
 * ## Why containers
 *
 * A container is an ordered list of blocks. Text is text, rules are rules, and
 * the layout is whatever the content needs — a roll result is a headline with a
 * body and a provenance line, not a set of fixed slots.
 *
 * With `MessageFlags.IsComponentsV2` set, Discord rejects `content` and
 * `embeds` outright — it is all-in per message. `ContainerBuilder.
 * setAccentColor()` carries the tier colour as a `0xRRGGBB` integer.
 *
 * ## Why this module is pure
 *
 * Builders take data and return `ContainerData`. That is not only for
 * testability: a sent container has no seam to mutate, so changing one means
 * rebuilding it, and a pure builder makes "rebuild with one more line" a
 * re-invocation rather than a special case. See `rollAttribution.ts`.
 *
 * ## Two shapes of builder
 *
 * A roll, an error and an invite DM author their blocks directly. Every
 * **entity** surface — a `/su lookup` entry, a sheet, the crew board, a game
 * card — shares one shape (heading, prose, labelled fields, a provenance line,
 * maybe artwork) and renders it through {@link entityCard}, so that shape is
 * mapped onto blocks in exactly one place.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from '@discordjs/builders'
import { ButtonStyle, SeparatorSpacingSize } from 'discord-api-types/v10'
import { truncate } from 'salvageunion-reference'

/**
 * Discord's Components V2 ceilings.
 *
 * These are **server-side** and encoded in none of the installed packages —
 * `@discordjs/builders` imposes no total-component cap, so nothing local will
 * tell you when a container is too big. They are recorded here so one place
 * owns them, and are deliberately conservative.
 */
export const V2_LIMIT = {
  /** Components in one message, counting the container and everything inside. */
  components: 40,
  /** Characters across every TextDisplay in the message. */
  totalText: 4000,
  /** Characters in a single TextDisplay (a builder-enforced predicate). */
  textDisplay: 4000,
  /** Buttons in one action row. */
  rowButtons: 5,
} as const

/** A button that re-invokes the bot, or one that just opens a URL. */
export type ButtonSpec =
  | { kind: 'action'; customId: string; label: string; style?: ButtonStyle }
  | { kind: 'link'; url: string; label: string }

/** One block in a container, in render order. */
export type ContainerBlock =
  | { kind: 'text'; content: string }
  | { kind: 'separator'; divider?: boolean; large?: boolean }
  | {
      kind: 'section'
      /** 1–3 text blocks, per the builder's own predicate. */
      text: string[]
      thumbnail?: { url: string; description?: string }
    }
  | { kind: 'buttons'; buttons: ButtonSpec[] }

/** Everything needed to render one container. Pure data — no builders. */
export type ContainerData = {
  /** The accent stripe, a `0xRRGGBB` integer. */
  accent: number
  blocks: ContainerBlock[]
}

/** Rendered text length, as Discord counts it across every TextDisplay. */
export function containerTextLength(data: ContainerData): number {
  return data.blocks.reduce((n, block) => {
    if (block.kind === 'text') return n + block.content.length
    if (block.kind === 'section') return n + block.text.reduce((m, t) => m + t.length, 0)
    return n
  }, 0)
}

/**
 * Component count as Discord counts it: the container itself, every block, and
 * every leaf inside a section or a row.
 */
export function containerComponentCount(data: ContainerData): number {
  const cost = (block: ContainerBlock): number => {
    // the section, its text blocks, and the thumbnail accessory
    if (block.kind === 'section') return 1 + block.text.length + (block.thumbnail ? 1 : 0)
    if (block.kind === 'buttons') return 1 + block.buttons.length
    return 1
  }
  // 1 for the container itself.
  return data.blocks.reduce((n, block) => n + cost(block), 1)
}

/**
 * Trim a container to fit, shedding whole blocks from the end.
 *
 * Shedding from the end is deliberate: the blocks that matter most — the headline and the outcome —
 * are authored first, and half a provenance line is worse than none. Buttons
 * are never shed, because a roll result that loses its "Roll again" stops being
 * the thing people use.
 */
export function enforceContainerLimits(data: ContainerData): ContainerData {
  const blocks = data.blocks.map((block) =>
    block.kind === 'text'
      ? { ...block, content: truncate(block.content, V2_LIMIT.textDisplay) }
      : block.kind === 'section'
        ? { ...block, text: block.text.slice(0, 3).map((t) => truncate(t, V2_LIMIT.textDisplay)) }
        : block
  )

  const trimmed: ContainerData = { ...data, blocks }
  const isButtons = (b: ContainerBlock): boolean => b.kind === 'buttons'
  while (
    (containerTextLength(trimmed) > V2_LIMIT.totalText ||
      containerComponentCount(trimmed) > V2_LIMIT.components) &&
    trimmed.blocks.some((b) => !isButtons(b))
  ) {
    // Drop the last non-button block.
    const index = trimmed.blocks.map(isButtons).lastIndexOf(false)
    if (index === -1) break
    trimmed.blocks.splice(index, 1)
  }
  return trimmed
}

/** A labelled value on an entity card. */
export type CardField = { name: string; value: string; inline?: boolean }

/** The shape every entity surface shares; {@link entityCard} renders it. */
export type EntityCard = {
  title: string
  /** Where the title links. Omitted rather than dead when there is nowhere to go. */
  url?: string
  accent: number
  description?: string
  fields: CardField[]
  /** Provenance, rendered as a `-#` subtext line under a rule. */
  footer: string
  /**
   * Absolute `https://` URL of the artwork CDN image, never an attachment, so
   * no bytes pass through the Worker. Undefined when the entity has no art.
   */
  thumbnail?: string
}

/** The title as a `##` heading, a masked link when there is a page to open. */
function cardHeading(title: string, url: string | undefined): string {
  return url ? `## [${title}](${url})` : `## ${title}`
}

/**
 * Fields as blocks.
 *
 * A container has no columns, so **consecutive inline fields merge into one
 * text block, one `**Name** value` per line**. A vitals rail then reads as one
 * instrument (the gauges align on their left edge) and short label/value pairs
 * stay compact. A full-width field is a slab: its name a bold heading, its
 * value the body beneath.
 */
function fieldBlocks(fields: CardField[]): ContainerBlock[] {
  const blocks: ContainerBlock[] = []
  let run: string[] = []

  const flush = (): void => {
    if (run.length > 0) {
      blocks.push({ kind: 'text', content: run.join('\n') })
      run = []
    }
  }

  for (const field of fields) {
    if (field.inline === true) {
      run.push(`**${field.name}** ${field.value}`)
      continue
    }
    flush()
    blocks.push({ kind: 'text', content: `**${field.name}**\n${field.value}` })
  }
  flush()
  return blocks
}

/**
 * Render an entity card: heading, prose, fields, then a rule and the footer.
 *
 * With artwork, the heading and the prose sit in a section so the thumbnail
 * hangs beside them, pinned to the identity rather than floating above the
 * fields. Without it they are ordinary blocks — an empty section would render
 * as a narrowed column with nothing in the gutter.
 *
 * Limits are not applied here: `toContainer` enforces them for every reply.
 */
export function entityCard(card: EntityCard): ContainerData {
  const heading = cardHeading(card.title, card.url)
  const blocks: ContainerBlock[] = []

  if (card.thumbnail !== undefined) {
    blocks.push({
      kind: 'section',
      text: card.description ? [heading, card.description] : [heading],
      thumbnail: { url: card.thumbnail, description: card.title },
    })
  } else {
    blocks.push({ kind: 'text', content: heading })
    if (card.description) blocks.push({ kind: 'text', content: card.description })
  }

  blocks.push(...fieldBlocks(card.fields))
  blocks.push({ kind: 'separator' })
  blocks.push({ kind: 'text', content: `-# ${card.footer}` })

  return { accent: card.accent, blocks }
}

function toButton(spec: ButtonSpec): ButtonBuilder {
  return spec.kind === 'link'
    ? new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(spec.url).setLabel(spec.label)
    : new ButtonBuilder()
        .setStyle(spec.style ?? ButtonStyle.Secondary)
        .setCustomId(spec.customId)
        .setLabel(spec.label)
}

/**
 * Build the container. Enforces limits first, so a caller cannot skip the
 * guard: this is the one choke point every reply passes through.
 */
export function toContainer(data: ContainerData): ContainerBuilder {
  const safe = enforceContainerLimits(data)
  const container = new ContainerBuilder().setAccentColor(safe.accent)

  for (const block of safe.blocks) {
    switch (block.kind) {
      case 'text':
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content))
        break
      case 'separator':
        container.addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(block.divider ?? true)
            .setSpacing(block.large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)
        )
        break
      case 'section': {
        const section = new SectionBuilder().addTextDisplayComponents(
          ...block.text.map((t) => new TextDisplayBuilder().setContent(t))
        )
        if (block.thumbnail) {
          const thumb = new ThumbnailBuilder().setURL(block.thumbnail.url)
          if (block.thumbnail.description) thumb.setDescription(block.thumbnail.description)
          section.setThumbnailAccessory(thumb)
        }
        container.addSectionComponents(section)
        break
      }
      case 'buttons': {
        const buttons = block.buttons.slice(0, V2_LIMIT.rowButtons).map(toButton)
        if (buttons.length > 0) {
          container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)
          )
        }
        break
      }
    }
  }
  return container
}
