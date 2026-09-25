/**
 * The wire shapes the ITUN Convex deployment returns to the bot.
 *
 * These are **imported**, not copied: the single declaration is
 * `apps/itun/convex/model/botWire.ts`, which `convex/botClient.ts` annotates
 * every handler with. Change a `botClient` return shape and both sides fail to
 * compile until that file agrees. They used to be hand-copied here on the
 * theory that importing would "drag React" into the Worker; it cannot, because
 * `import type` is erased at bundle time, and `botWire.ts` imports nothing at
 * all, so it type-checks cleanly under this workspace's `nodenext` settings.
 *
 * What sharing does NOT buy is validation. This is still a network boundary and
 * the bot and the deployment ship separately, so every field is still read
 * defensively (a removed field degrades to "—" rather than throwing) — see
 * `SheetResult.publicRead` for the worked example of a key an older deployment
 * does not send.
 *
 * Server-side coverage of these shapes: `apps/itun/test/convex/bot.test.ts`.
 */

import type { BotDenialReason } from '../../../itun/convex/model/botWire.js'

export type {
  BindResult,
  ChannelResult,
  CrewResult,
  EntityBody,
  GameSummary,
  GamesResult,
  MeResult,
  OwnedEntity,
  SheetResult,
  SheetTable,
  ShelfResult,
} from '../../../itun/convex/model/botWire.js'

/** Why a call could not be satisfied: `BotDenial` plus the mutation cases. */
export type DenialReason = BotDenialReason

/**
 * The result of any ITUN call, as three cases the commands must all handle.
 *
 * Bot-side only — the wire carries `ok`/`reason`, and `client.ts` interprets
 * it into this. `unavailable` is separate from `denied` on purpose: it is the
 * bot's **Degraded** mode (ADR-030's three storage modes, applied to the bot).
 * "ITUN is down" and "you are not in this game" want different words, and
 * collapsing them would have every outage read as a permissions problem.
 */
export type ItunResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'denied'; reason: DenialReason; message: string }
  | { kind: 'unavailable'; message: string }
