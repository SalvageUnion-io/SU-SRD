import type { RoleFlags } from './roles'

/**
 * Discord channel rules for a Game, as pure predicates. The Worker authorizes
 * with them and Play reads the same answers
 * for its Post toggle, so the two cannot disagree.
 */

/**
 * Whether this member may bind a Discord channel to the Game (`/su bind`), or
 * unbind it: the Mediator or the Organiser. A channel is the table's, so a
 * player alone cannot point the whole Game's rolls somewhere.
 */
export function mayBindChannel(member: RoleFlags): boolean {
  return member.mediator || member.organizer
}

/**
 * Whether a roll posts to the bound channel unless the roller says otherwise.
 *
 * A player's rolls are a social act and post; the Mediator rolls behind the
 * screen, so theirs default to private. Solo play (`null`: no membership) posts
 * to the person's own channel. This is only the default: every roll can
 * override it, and `channelBindings.postRoll` posts exactly what it is told.
 */
export function postsByDefault(member: Pick<RoleFlags, 'mediator'> | null): boolean {
  return member === null || !member.mediator
}

/**
 * What `channelBindings.postRoll` did with one roll, for the Feed to show:
 *
 *   - `posted`: the card is in the channel (`messageId` is Discord's).
 *   - `skipped`: the roller chose not to post (`post: false`).
 *   - `unbound`: no channel is bound to this Game (or to this person's solo
 *     play), so nothing was posted. Not an error: binding is optional.
 *   - `failed`: a channel is bound and the post did not land. `message` is
 *     fit to show the roller; the failure is also logged
 *     (`channelBindings.postRoll`).
 */
export type PostRollResult =
  | { kind: 'posted'; channelId: string; messageId: string }
  | { kind: 'skipped' }
  | { kind: 'unbound' }
  | { kind: 'failed'; channelId: string | null; message: string }
