/**
 * The words the bot shows for each refusal, spelled once for both servers
 * that answer it: Convex's `botClient` and the site Worker's `BotGateway`.
 * Kept out of `botWire.ts`, which must import nothing but `entityKinds`.
 */

import type { BotDenialReason, BotFailure } from './botWire'
import { PRODUCT } from './product'

const DENIAL_MESSAGE: Record<BotDenialReason, string> = {
  unlinked: `No ${PRODUCT.wordmark} account is signed in with this Discord account.`,
  'not-found': 'That could not be found.',
  forbidden: 'You cannot do that here.',
}

/** A refusal for `reason`, in its own words unless `message` says otherwise. */
export function botDenial(reason: BotDenialReason, message?: string): BotFailure {
  return { ok: false, reason, message: message ?? DENIAL_MESSAGE[reason] }
}
