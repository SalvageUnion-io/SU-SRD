import { ConvexError } from 'convex/values'

/**
 * Telling a server refusal apart from a server defect, on the client.
 *
 * Convex draws exactly one line across everything `convex/` can throw, and it
 * draws it at the wire:
 *
 * - a **`ConvexError`** arrives with its `data` intact, because the backend
 *   declared the message fit to show;
 * - **anything else** arrives as `"[CONVEX M(fn)] […] Server Error"`, with the
 *   real message stripped so a crash cannot leak internals.
 *
 * `convex/model/permissions.ts` puts the domain refusals on the first side of
 * that line (`NotAuthorized extends ConvexError`) and leaves genuine defects on
 * the second. This module is the client half: it turns "which side of the line
 * was this?" into an answer a component can act on, so nobody has to
 * string-match `'Server Error'` at a call site to find out.
 *
 * The subclass does not survive serialization — the client gets a plain
 * `ConvexError` carrying the message as `data` — so `instanceof ConvexError` is
 * the only narrowing that works here. `instanceof NotAuthorized` would compile
 * and always be false.
 */

/**
 * The player-facing message the server chose to send, or `null` when it sent
 * none.
 *
 * `null` is the meaningful case: it means the throw was **not** a deliberate
 * refusal, so there is no sanctioned copy to show and the honest options are a
 * generic message plus a Sentry report. Never fall back to `String(err)` for
 * display — that is where the opaque `"[CONVEX M(entities:upsertByAppId)] […]
 * Server Error"` string comes from, and showing it to a player is strictly
 * worse than saying nothing.
 */
export function serverMessage(err: unknown): string | null {
  if (!(err instanceof ConvexError)) return null
  // `data` is typed `Value` — any Convex value. Everything this backend throws
  // uses a string, but a non-string would stringify to something unreadable,
  // so it is treated as "no message" rather than shown.
  return typeof err.data === 'string' && err.data.length > 0 ? err.data : null
}

/**
 * Whether this error is a deliberate refusal rather than a defect.
 *
 * Worth having as its own verb because the two call for opposite handling:
 * a refusal is the system working (show the message, do not alert an operator),
 * a defect is not (generic message, report it).
 */
export function isServerRefusal(err: unknown): boolean {
  return serverMessage(err) !== null
}
