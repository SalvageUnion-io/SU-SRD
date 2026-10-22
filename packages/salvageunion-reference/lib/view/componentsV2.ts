/**
 * The ONE Components V2 serialiser: a container's blocks as the JSON Discord
 * reads. The SRD's Component Embed (`componentEmbedJson`) and every bot reply
 * (the bot's `toContainer`) are written by it, so the two surfaces speak one
 * wire format.
 *
 * Pure data in, plain JSON out; no limits applied. The bot sheds a reply to
 * Discord's ceilings before it serialises (`enforceContainerLimits`), and an
 * entry card is shed to the Component Embed's budget (`discordEntryCard`).
 */

/** Discord's component type ids (Components V2). */
const TYPE = {
  row: 1,
  button: 2,
  select: 3,
  section: 9,
  text: 10,
  thumbnail: 11,
  separator: 14,
  container: 17,
} as const

/** Discord's button styles this serialiser defaults to. */
const STYLE = { secondary: 2, link: 5 } as const

/** A button that calls the bot back, or one that only opens a URL. */
export type V2Button =
  | {
      kind: 'action'
      customId: string
      label: string
      /** Discord's `ButtonStyle`; secondary unless set. */
      style?: number
      disabled?: boolean
    }
  | { kind: 'link'; url: string; label: string }

/** One block of a container, in render order. */
export type V2Block =
  | { kind: 'text'; content: string }
  | { kind: 'separator' }
  | {
      kind: 'section'
      /** 1–3 text blocks, Discord's own limit. */
      text: string[]
      thumbnail?: { url: string; description?: string }
      /** Or a button beside the text, which acts on that line; a thumbnail wins. */
      button?: V2Button
    }
  | { kind: 'buttons'; buttons: V2Button[] }
  | {
      kind: 'select'
      customId: string
      placeholder: string
      options: { label: string; value: string; description?: string }[]
    }

/** A container: the accent stripe (a `0xRRGGBB` integer) and its blocks. */
export type V2Container = { accent: number; blocks: readonly V2Block[] }

/** A component as Discord reads it. */
export type V2Json = { type: number } & Record<string, unknown>

function button(spec: V2Button): V2Json {
  return spec.kind === 'link'
    ? { type: TYPE.button, style: STYLE.link, url: spec.url, label: spec.label }
    : {
        type: TYPE.button,
        style: spec.style ?? STYLE.secondary,
        custom_id: spec.customId,
        label: spec.label,
        disabled: spec.disabled === true,
      }
}

function accessory(block: Extract<V2Block, { kind: 'section' }>): V2Json | undefined {
  const { thumbnail } = block
  if (thumbnail) {
    return {
      type: TYPE.thumbnail,
      media: { url: thumbnail.url },
      ...(thumbnail.description ? { description: thumbnail.description } : {}),
    }
  }
  return block.button ? button(block.button) : undefined
}

/** A block as its component, or `undefined` for a row with nothing in it. */
function component(block: V2Block): V2Json | undefined {
  switch (block.kind) {
    case 'text':
      return { type: TYPE.text, content: block.content }
    case 'separator':
      return { type: TYPE.separator, divider: true, spacing: 1 }
    case 'section': {
      const side = accessory(block)
      return {
        type: TYPE.section,
        components: block.text.map((content) => ({ type: TYPE.text, content })),
        ...(side ? { accessory: side } : {}),
      }
    }
    case 'buttons':
      return block.buttons.length > 0
        ? { type: TYPE.row, components: block.buttons.map(button) }
        : undefined
    case 'select':
      return block.options.length > 0
        ? {
            type: TYPE.row,
            components: [
              {
                type: TYPE.select,
                custom_id: block.customId,
                placeholder: block.placeholder,
                options: block.options.map(({ label, value, description }) => ({
                  label,
                  value,
                  ...(description ? { description } : {}),
                })),
              },
            ],
          }
        : undefined
  }
}

/** A container as Discord's Components V2 JSON. */
export function toComponentsV2(container: V2Container): V2Json {
  return {
    type: TYPE.container,
    accent_color: container.accent,
    components: container.blocks.flatMap((block) => component(block) ?? []),
  }
}
