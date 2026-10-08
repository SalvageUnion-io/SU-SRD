/**
 * slotLayout — who holds the Major slot (docs/architecture/dashboard-redesign.md
 * D1). Pure, so the rule is testable without rendering a slot:
 *
 * | Mount     | Major   | Minors          |
 * | --------- | ------- | --------------- |
 * | on foot   | Pilot   | Mech, Crawler   |
 * | boarded   | Mech    | Pilot, Crawler  |
 * | Downtime  | Crawler | Pilot, Mech     |
 *
 * Nothing else moves the slots: ⤢ opens a Minor's controls over the display
 * and leaves this answer alone.
 */

import type { MountState } from './useSeat'

export type SlotKind = 'pilot' | 'mech' | 'crawler'

export type SlotLayout = { major: SlotKind; minors: readonly [SlotKind, SlotKind] }

export function slotsFor(mount: MountState): SlotLayout {
  switch (mount) {
    case 'pilot':
      return { major: 'pilot', minors: ['mech', 'crawler'] }
    case 'mech':
      return { major: 'mech', minors: ['pilot', 'crawler'] }
    case 'downtime':
      return { major: 'crawler', minors: ['pilot', 'mech'] }
  }
}
