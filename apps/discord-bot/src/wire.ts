import type { APIMessageTopLevelComponent } from 'discord-api-types/v10'

/**
 * A message as the bot's code builds it. The `build*Message` helpers return
 * more than this (the `data` they rendered from, an `ephemeral` marker); those
 * keys are ours, and `toWire` drops them.
 */
export type MessagePayload = {
  /** `null` only on an edit, which may clear the content. */
  content?: string | null
  components?: readonly APIMessageTopLevelComponent[]
  flags?: number
}

/** What every bot message goes to Discord as: the keys it reads, mention-inert. */
export type WireMessage = MessagePayload & { allowed_mentions: { parse: [] } }

/**
 * The one shape every bot message leaves in, applied by the transport
 * (`worker/adapter.ts`'s reply members, `worker/relay.ts`, the Worker's
 * fallbacks), so no send site can skip it.
 *
 * Only `content`, `components` and `flags` pass, so a builder's own keys never
 * reach Discord. `allowed_mentions` is empty: a callsign or display name a
 * player typed (`@everyone`, `<@&role>`) shows as text and pings nobody.
 */
export function toWire(payload: MessagePayload): WireMessage {
  return {
    ...(payload.content !== undefined ? { content: payload.content } : {}),
    ...(payload.components !== undefined ? { components: payload.components } : {}),
    ...(payload.flags !== undefined ? { flags: payload.flags } : {}),
    allowed_mentions: { parse: [] },
  }
}
