/**
 * A refusal the player reads: a request the rules turn down, worded for them.
 * Anything else a room throws is a defect, and the Worker answers it without
 * its message, as `NotAuthorized` against a plain `Error` on Convex.
 */
export class RoomRefusal extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoomRefusal'
  }
}
