/**
 * The steps of a resolve taken offline (r6 A14): its roll rolls on the
 * device, and each seat act it makes (`seats.setResolving`,
 * `seats.clearResolving`) is held here, in order, until the connection
 * returns. The roll's own Feed line is the Rolls' queue's, "Not sent yet"
 * (`usePlayRollDispatch`, r5 A6). Held in memory, for the open tab.
 *
 * Each held step names the step it `follows`: the seat as the room last
 * served it, then each held step before it. The room refuses one whose seat
 * moved on meanwhile (a turn ended, Downtime began, `rooms/seats.ts`), and
 * the rest are dropped with it: said, never applied over the table.
 */

import type { SeatResolving } from 'game-domain/schemas/seat'
import { WritesBlockedOffline } from '../replica/sync'

/** One held seat act: the resolve it writes (null: the resolve is over), and the one it follows. */
export type HeldStep = { resolving: SeatResolving | null; follows: SeatResolving | null }

export class HeldResolve {
  private queue: HeldStep[] = []
  private sending = false

  constructor(private readonly changed: () => void = () => undefined) {}

  /** Whether a step waits to be sent. */
  get pending(): boolean {
    return this.queue.length > 0
  }

  /** The resolve as this device has it: the last held step's, else what the room served. */
  view(served: SeatResolving | null): SeatResolving | null {
    const last = this.queue.at(-1)
    return last === undefined ? served : last.resolving
  }

  /** Hold a step, after the last held one, or after `served` when none is. */
  hold(resolving: SeatResolving | null, served: SeatResolving | null): void {
    this.queue.push({ resolving, follows: this.view(served) })
    this.changed()
  }

  /**
   * Send what is held, oldest first, each once the one before it landed. A
   * step the connection drops stays held for the next return; one the room
   * refuses is handed to `refused`, and the rest are dropped with it.
   */
  async send(
    act: (step: HeldStep) => Promise<unknown>,
    refused: (step: HeldStep, err: unknown) => void
  ): Promise<void> {
    if (this.sending) return
    this.sending = true
    let went = false
    try {
      for (let step = this.queue[0]; step !== undefined; step = this.queue[0]) {
        try {
          await act(step)
        } catch (err) {
          if (err instanceof WritesBlockedOffline) return
          this.queue = []
          went = true
          refused(step, err)
          return
        }
        this.queue.shift()
        went = true
      }
    } finally {
      this.sending = false
      // Said only when something went: a drop waits, untried, for the next return.
      if (went) this.changed()
    }
  }
}
