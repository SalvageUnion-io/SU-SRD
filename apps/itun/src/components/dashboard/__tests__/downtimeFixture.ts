/**
 * A `DowntimeHandle` for tests that render the wizard or a slot without
 * Convex: the Game's Downtime as given, and every write recorded by name.
 */

import type { DowntimeHandle, DowntimeView } from '../useDowntime'
import { NOT_RUNNING } from '../useDowntime'

export type DowntimeCall = { name: string; args: unknown[] }

export function downtimeHandle(
  view: Partial<DowntimeView> = {},
  spendAnswer = true
): { handle: DowntimeHandle; calls: DowntimeCall[] } {
  const calls: DowntimeCall[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args })
    }
  return {
    calls,
    handle: {
      downtime: { ...NOT_RUNNING, ...view },
      begin: record('begin'),
      advance: record('advance'),
      end: record('end'),
      markDone: record('markDone'),
      spendUpkeep: async () => {
        calls.push({ name: 'spendUpkeep', args: [] })
        return spendAnswer
      },
    },
  }
}
