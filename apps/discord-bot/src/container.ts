/**
 * Components V2 plumbing — the `data → ContainerBuilder` seam.
 *
 * ## Why containers rather than embeds
 *
 * An embed is a fixed set of slots: title, description, up to 25 fields, one
 * footer. That shape is wrong for a roll result, which is a headline with a
 * body and a provenance line — so the old builder spent three inline fields on
 * `Table / Roll / Range`, roughly six lines of mobile chrome to deliver twelve
 * characters, and had nowhere to put anything else.
 *
 * A container is an ordered list of blocks. Text is text, rules are rules, and
 * the layout is whatever the content needs. See
 * `docs/design/discord-bot-roll-experience.md` §5.
 *
 * ## What V2 costs, and what it does not
 *
 * With `MessageFlags.IsComponentsV2` set, Discord rejects `content` and
 * `embeds` outright — it is all-in per message. The author, footer and
 * timestamp slots go with them and become ordinary text lines.
 *
 * It does **not** cost the tier colour, which was the real risk:
 * `ContainerBuilder.setAccentColor()` is the direct equivalent of an embed's
 * coloured edge, and carries the same `0xRRGGBB` integer.
 *
 * ## Why this module is pure
 *
 * Builders take data and return data, exactly as `gameEmbed.ts` does. That is
 * not only for testability: recording a roll to a bound Game used to mutate the
 * sent message (`embed.setFooter(…)`), and a container has no such seam — you
 * rebuild it. A pure builder makes "rebuild with one more line" a re-invocation
 * rather than a special case. See `rollAttribution.ts`.
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
import { truncate } from './format.js'

/**
 * Discord's Components V2 ceilings.
 *
 * These are **server-side** and encoded in none of the installed packages —
 * `@discordjs/builders` imposes no total-component cap, so nothing local will
 * tell you when a container is too big. They are recorded here so one place
 * owns them, and are deliberately conservative.
 *
 * `EMBED_LIMIT.total` (6000) does **not** apply to a container: it is a
 * different budget with a different shape, which is why this module carries its
 * own guard rather than reusing `enforceEmbedLimits`.
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

/** Everything needed to render one container. Pure data — no discord.js. */
export type ContainerData = {
  /** The accent stripe, same `0xRRGGBB` integer an embed colour takes. */
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
 * Shedding from the end is the same choice `enforceEmbedLimits` makes and for
 * the same reason: the blocks that matter most — the headline and the outcome —
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
 * guard — the same single-choke-point rule `toEmbed` follows in `itunReply.ts`.
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
