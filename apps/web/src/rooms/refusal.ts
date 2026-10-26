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

/** `run`'s value, or the refusal it threw; anything else it throws is a defect and throws on. */
export function answerOrRefuse<T>(
  run: () => T
): { ok: true; value: T } | { ok: false; refusal: string } {
  try {
    return { ok: true, value: run() }
  } catch (error) {
    if (error instanceof RoomRefusal) return { ok: false, refusal: error.message }
    throw error
  }
}
