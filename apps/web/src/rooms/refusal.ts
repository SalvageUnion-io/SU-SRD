/**
 * A refusal the player reads: a request the rules turn down, worded for them.
 * Anything else a room throws is a defect, and the Worker answers it without
 * its message.
 */
export class RoomRefusal extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoomRefusal'
  }
}
