/**
 * A link the assignment rules refused (ADR-037), with copy fit for a player.
 *
 * Thrown by the store when it can see the refusal coming — the two ends are in
 * different containers — and by `assignLink` when the server refused instead,
 * carrying the server's `ConvexError` message. A surface can therefore show
 * `err.message` for either, without asking which side said no.
 *
 * Not used server-side: Convex throws `ConvexError` there, which is what crosses
 * the wire intact.
 */
export class LinkRefused extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'LinkRefused'
  }
}
