/**
 * What a session that ended comes to (r6 C1, LG6-16): the recap a Game's page
 * leads with until the next session starts, pure, off the same stretch of
 * events "Last time at the table" reads (`lastSession.model.ts`). Each unit's
 * net change to HP and SP over the session, from where it started to where it
 * was left, and which of them ended Down (at 0); what was salvaged and
 * where Scrap went (an accepted proposal of parts, a moved Scrap line); the
 * damage its players accepted, said as damage, never "changed hands" (r7 C10,
 * LG7-21); and whether a Downtime ran. What is still open and the plans are
 * the page's to add.
 */

import type { VitalChange } from '../../rooms/game/eventLines'
import type { TableEvent } from '../../rooms/game/events'

/** One unit's vital over the session: where it started, where it was left. */
type RecapVital = { who: string; label: string; from: number; to: number; down: boolean }

export type SessionRecap = {
  /** HP and SP that ended lower than they started, the Down ones first. */
  hurt: RecapVital[]
  /** What was salvaged and where Scrap went: accepted parts, moved Scrap, in order. */
  moved: string[]
  /** The damage each accepted proposal wrote, in the order it was accepted. */
  damageTaken: string[]
  /** A Downtime was begun in the session. */
  downtime: boolean
}

/** The vitals a recap adds up: what a unit loses in a fight. */
const COUNTED = new Set(['HP', 'SP'])

/** "Ash accepted: Rigging Arm to Pickle's Spectrum" → what moved. */
const ACCEPTED = /^.*? accepted: /

/** An accepted proposal that wrote a vital ("Pumpkin · HP → 6"): damage, not a part. */
const VITAL_WRITE = /\b(HP|SP|AP|EP|Heat) → /

/** A Downtime line that moved Scrap (`downtime.moveScrap`). */
const MOVED_SCRAP = /moved their Scrap$/

/** The recap of a session's events (any order); null when nothing in it is worth one. */
export function sessionRecap(lines: readonly TableEvent[]): SessionRecap | null {
  const ordered = [...lines].sort((a, b) => a.ts - b.ts)
  const net = new Map<string, { who: string; label: string; from: number | null; to: number }>()
  for (const { vital } of ordered) {
    if (vital === undefined || !COUNTED.has(vital.label)) continue
    const key = `${vital.who}\u0000${vital.label}`
    const was = net.get(key)
    net.set(key, { ...withFrom(vital, was?.from ?? null), to: vital.to })
  }
  const hurt = [...net.values()]
    .flatMap((v) =>
      v.from !== null && v.to < v.from
        ? [{ who: v.who, label: v.label, from: v.from, to: v.to, down: v.to === 0 }]
        : []
    )
    .sort((a, b) => Number(b.down) - Number(a.down))
  const accepted = ordered
    .filter((event) => event.kind === 'proposal' && event.answer === 'accepted')
    .map((event) => event.text.replace(ACCEPTED, ''))
  const damageTaken = accepted.filter((line) => VITAL_WRITE.test(line))
  const moved = ordered.flatMap((event) => {
    if (event.kind === 'downtime' && MOVED_SCRAP.test(event.text)) return [event.text]
    if (event.kind !== 'proposal' || event.answer !== 'accepted') return []
    const line = event.text.replace(ACCEPTED, '')
    return VITAL_WRITE.test(line) ? [] : [line]
  })
  const downtime = ordered.some(
    (event) => event.kind === 'downtime' && /began Downtime$/.test(event.text)
  )
  if (hurt.length === 0 && moved.length === 0 && damageTaken.length === 0 && !downtime) return null
  return { hurt, moved, damageTaken, downtime }
}

/** A vital's first reading keeps where the session found it. */
function withFrom(vital: VitalChange, from: number | null) {
  return { who: vital.who, label: vital.label, from: from ?? vital.from }
}
