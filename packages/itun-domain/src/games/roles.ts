/**
 * A Game's roles, as pure predicates (ADR-030 §3).
 *
 * The role model is a base role plus one modifier: every member is a Player or
 * a Mediator, and exactly one also carries `organizer`. Both ends read these
 * answers: the server authorizes with them (`convex/model/permissions.ts`) and
 * the Game surface hides what the server would refuse
 * (`src/lib/games/gameRoster.ts`). One copy here means the two cannot disagree.
 *
 * Pure: no Convex, no React. The server reads the roster from the database and
 * hands these functions plain flags.
 */

/** A member's role flags, as a `memberships` row stores them. */
export type RoleFlags = { mediator: boolean; organizer: boolean }

/**
 * Whether anybody in this roster mediates. The Dashboard opens only when one
 * does (ADR-038 §1); an Organizer standing in as table runner does not count.
 */
export function hasMediator(members: readonly Pick<RoleFlags, 'mediator'>[]): boolean {
  return members.some((m) => m.mediator)
}

/**
 * Whether this member runs the table: the Mediator, or the Organizer *only
 * while nobody mediates*.
 *
 * The Organizer fallback is the one bend in "Organizer confers no content
 * authority": without it a Game made by one person, its Organizer and no
 * Mediator, could never raise its first crawler. The caller reads
 * `gameHasMediator` fresh each time, so appointing a Mediator takes it back at
 * once.
 */
export function runsTable(member: RoleFlags, gameHasMediator: boolean): boolean {
  return member.mediator || (member.organizer && !gameHasMediator)
}
