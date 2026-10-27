/**
 * The wire shapes the site Worker's `BotGateway` answers the bot.
 *
 * These are **imported**, not copied: the single declaration is
 * `packages/game-domain/src/botWire.ts`, which the gateway
 * (`apps/web/src/worker/botGateway.ts`) answers in. Change a shape and both
 * sides fail to compile until that file agrees. Importing cannot drag React into the Worker:
 * `import type` is erased at bundle time, and `botWire.ts` imports nothing at
 * all, so it type-checks cleanly under this workspace's settings.
 *
 * What sharing does NOT buy is validation. This is still a network boundary and
 * the bot and the site ship separately, so every field is still read
 * defensively (a removed field degrades to "—" rather than throwing) — see
 * `SheetResult.publicRead` for the worked example of a key an older site
 * does not send.
 *
 * Server-side coverage of these shapes: `apps/web/src/worker/__tests__/botGateway.test.ts`.
 */

import type { BotDenialReason } from 'game-domain/botWire'

export type {
  BindChannelResult,
  BotFeedbackResult,
  BotUsageResult,
  ChannelBindingSummary,
  EntityBody,
  GameSummary,
  GamesResult,
  MechDerived,
  MeResult,
  MineResult,
  PilotDerived,
  SheetResult,
  UnbindChannelResult,
} from 'game-domain/botWire'
export type { SheetTable } from 'game-domain/entityKinds'

/** Why a call could not be satisfied. */
export type DenialReason = BotDenialReason

/**
 * The result of any app call, as three cases the commands must all handle.
 *
 * Bot-side only — the wire carries `ok`/`reason`, and `client.ts` interprets
 * it into this. `unavailable` is separate from `denied` on purpose: it is the
 * bot's **Degraded** mode (ADR-030's three storage modes, applied to the bot).
 * "The app is down" and "you are not in this game" want different words, and
 * collapsing them would have every outage read as a permissions problem.
 */
export type SiteResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'denied'; reason: DenialReason; message: string }
  | { kind: 'unavailable'; message: string }
