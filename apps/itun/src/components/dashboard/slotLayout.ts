/**
 * slotLayout — who holds the Major slot (ADR-038 §3). Pure, so the rule is testable without rendering a slot:
 *
 * | Mount     | Major   | Minors          |
 * | --------- | ------- | --------------- |
 * | on foot   | Pilot   | Mech, Crawler   |
 * | boarded   | Mech    | Pilot, Crawler  |
 * | Downtime  | Crawler | none            |
 *
 * In Downtime the Crawler takes the whole unit row (board D3, issue 1255):
 * every Downtime step acts on it. The pilot and the mech ride the rail as
 * compact links with their pips, which open their full controls, since
 * Restore, Customise your Mech and Train your Pilot need them.
 *
 * Nothing else moves the slots: ⤢ opens a Minor's controls over the display
 * and leaves this answer alone.
 */

import type { MountState } from './useSeat'

export type SlotKind = 'pilot' | 'mech' | 'crawler'

export type SlotLayout = { major: SlotKind; minors: readonly SlotKind[] }

const SLOT_COLOUR: Record<SlotKind, string> = {
  mech: 'var(--color-mech)',
  pilot: 'var(--color-pilot)',
  crawler: 'var(--color-crawler)',
}

/**
 * A slot's TOP RULE in its unit's colour (boards D1–D3): every slot, Major or
 * Minor, wears its unit colour the same way, and its title stays ink.
 */
export function slotRule(kind: SlotKind): string {
  return `6px solid ${SLOT_COLOUR[kind]}`
}

export function slotsFor(mount: MountState): SlotLayout {
  switch (mount) {
    case 'pilot':
      return { major: 'pilot', minors: ['mech', 'crawler'] }
    case 'mech':
      return { major: 'mech', minors: ['pilot', 'crawler'] }
    case 'downtime':
      return { major: 'crawler', minors: [] }
  }
}
