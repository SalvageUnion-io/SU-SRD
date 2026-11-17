import type { RoleFlags } from './roles'

/**
 * Discord channel rules for a Game, as pure predicates. The Worker authorizes
 * with them and Play reads the same answers, so the two cannot disagree.
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
 * What `channelBindings.postRoll` did with one roll, for the Feed to show:
 *
 *   - `posted`: the card is in the channel (`messageId` is Discord's).
 *   - `unbound`: no channel is bound to this Game or to the roller's own
 *     play, so nothing was posted. Not an error: binding is optional.
 *   - `failed`: a channel is bound and the post did not land. `message` is
 *     fit to show the roller; the failure is also logged
 *     (`channelBindings.postRoll`).
 */
export type PostRollResult =
  | { kind: 'posted'; channelId: string; messageId: string }
  | { kind: 'unbound' }
  | { kind: 'failed'; channelId: string | null; message: string }
