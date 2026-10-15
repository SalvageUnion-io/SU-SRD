/**
 * Pure shaping helpers shared by the bot's container builders — no Discord
 * objects, so everything here is unit-testable.
 */

/**
 * Attribution carried by every roll surface. Rolls are powered by
 * @randsum/roller, and that credit is not optional — it rides on its own
 * subtext line, separate from the "recorded to a Game" signal so that a real,
 * personal game fact is never buried inside licensing boilerplate.
 */
export const ROLL_ATTRIBUTION = 'Powered by Randsum.dev'
