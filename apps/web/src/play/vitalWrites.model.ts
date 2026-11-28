/**
 * Where a vital is heading while its writes are in flight (LG-03).
 *
 * Play shows a vital as the server last answered it (the replica is
 * server-first), and a − / + asks for "one off what is shown". Pressed three
 * times before the first answer, that is the same value asked for three times:
 * two presses lost. So each press is read as a step from what is shown, and
 * applied to where the vital is already heading; the replica sends the writes
 * in order (`units.ts`'s `inTurn`), each against the copy the last one left.
 */

/** A vital's key (`<unit id>:<field>`), where it is heading, and how many writes are out. */
const heading = new Map<string, { value: number; writes: number }>()

/** Where `key` stands before the next press: where it is heading, else what is `shown`. */
export function vitalNow(key: string, shown: number): number {
  return heading.get(key)?.value ?? shown
}

/**
 * The value to write for a press that asked for `next` while `shown` was on
 * screen: the same step taken from where the vital is heading, kept in
 * 0…`max`. Each call is one write out; pair it with `vitalSettled`.
 */
export function headedVital(key: string, shown: number, next: number, max: number): number {
  const out = heading.get(key)
  const value = Math.min(Math.max(0, max), Math.max(0, (out?.value ?? shown) + (next - shown)))
  heading.set(key, { value, writes: (out?.writes ?? 0) + 1 })
  return value
}

/** One write of `key` landed or failed: with none left out, the vital is what the screen shows again. */
export function vitalSettled(key: string): void {
  const out = heading.get(key)
  if (out === undefined) return
  if (out.writes <= 1) heading.delete(key)
  else heading.set(key, { ...out, writes: out.writes - 1 })
}
