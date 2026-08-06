/**
 * Copying an entity onto your own shelf (ADR-030 §2).
 *
 * ## Copy is not move, and the difference is the whole point
 *
 * **Move** changes `gameId` on the same record — same id, same body, same
 * history. **Copy** mints a genuinely new entity that has no relationship to
 * what it came from: new id, `COPY OF <name>`, always on the shelf, never in a
 * Game. It does not track its origin, sync with it, or follow it anywhere.
 *
 * That absence of a relationship is what makes copying safe, and it is exactly
 * what separates it from the **fork** ADR-030 originally specified and has since
 * dropped. A fork "records its origin", and a retained link between two records
 * of one character is the part that rots — something has to reconcile it, and
 * eventually something does not.
 *
 * ## Why it exists
 *
 * `ownership.leaveGame` has always documented this as the escape hatch —
 * *"a player who wants to keep a character copies it to their shelf first,
 * which is a separate, explicit act"* — while the act did not exist. Leaving a
 * Game left your character behind unclaimed with no way to keep one.
 *
 * ## The container it lands in follows from the ownership table
 *
 * ADR-030 §2 allows exactly three states, and a copy is unambiguously the third:
 *
 * | `gameId` | `ownerId` | State                     |
 * | -------- | --------- | ------------------------- |
 * | set      | set       | claimed and in play       |
 * | set      | null      | unclaimed, awaiting a taker |
 * | **null** | **set**   | **on the owner's shelf**  |
 * | null     | null      | invalid                   |
 *
 * So a copy is `gameId: null` with the copier as owner. It cannot be
 * "unclaimed" in the `ownerId: null` sense — that is the invalid row, and the
 * server refuses it (`entities.create`: *"A shelf has no crew to pick anything
 * up — shelved builds are yours"*). Unclaimed is a thing a character can be
 * **inside a Game**, waiting for somebody to take it; a shelf is already
 * somebody's.
 */

/** The loosest shape this needs: an opaque body that may carry a name. */
export type CopyableBody = Record<string, unknown>

/**
 * Fields the copy must not inherit.
 *
 * `id`/`createdAt`/`updatedAt` are minted by the db layer on create, so
 * carrying them through would either be overwritten or — worse for `id` —
 * produce a second record claiming to be the original, which is the exact
 * duplicate-`appId` condition that took a play session down.
 *
 * `workspaceId` is the retired pre-ADR-030 container. It is dropped rather than
 * copied because `containerOf` still reads it as a fallback, so a stale one
 * riding along on a copy could resolve the new entity back into a Game it was
 * explicitly copied out of.
 */
const DROPPED_FIELDS = ['id', 'createdAt', 'updatedAt', 'workspaceId'] as const

/** How a copy announces itself. Prefixed, so it sorts beside nothing and reads as derived. */
export function copyName(name: string): string {
  return `COPY OF ${name}`
}

/**
 * Build the create-input for a copy of `source`, destined for the copier's shelf.
 *
 * Takes an opaque body rather than a typed entity because both call sites hand
 * it one: a Game roster row carries the **server's** body (`listForGame`
 * returns `v.any()`), not a parsed local record. Validation is not skipped, it
 * is deferred to where it already happens — `entityStore.create` Zod-parses
 * every write, so a malformed source fails there with the same error any other
 * bad write would produce.
 *
 * `fallbackName` is used when the body carries no usable name, so a copy is
 * never called `COPY OF ` with nothing after it. Callers pass the name they are
 * already displaying.
 *
 * The body is otherwise copied **verbatim** — conditions, damage, scrap, TP and
 * all. A copy of a character mid-campaign is that character mid-campaign; a
 * pristine one is what the wizard is for.
 */
export function copyForShelf(source: CopyableBody, fallbackName: string): CopyableBody {
  const copy: CopyableBody = { ...source }
  for (const field of DROPPED_FIELDS) delete copy[field]

  const sourceName = typeof source.name === 'string' && source.name.length > 0 ? source.name : null
  copy.name = copyName(sourceName ?? fallbackName)

  // Explicitly null, never absent: `null` IS the shelf, while `undefined` means
  // "not decided yet" and would send the copy through `containerOf`'s legacy
  // fallback — and, worse, would let `entityStore.create` stamp whatever
  // container happens to be open, which for a copy made from a Game roster is
  // the Game it was just copied out of.
  copy.gameId = null

  return copy
}
