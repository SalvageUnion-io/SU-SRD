import { memberName } from 'game-domain/memberName'
import { pilotCallsign } from 'game-domain/pilotLabel'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  resolveInstalledRef,
  resolveModuleRef,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { seatOf } from '../seats'
import type { TableEvent, TableEventKind } from './events'
import type { GameStore } from './store'

/**
 * The words and the stored shape of the table's event lines (`events.ts`):
 * what a row keeps beside its line, how a repeat folds into the line it
 * follows, and how a line is signed and served.
 */

/** The vitals whose changes the table hears, by their sheet field. */
export const VITALS: Readonly<Record<string, string>> = {
  currentHP: 'HP',
  currentAP: 'AP',
  currentSP: 'SP',
  currentEP: 'EP',
  currentHeat: 'Heat',
}

/** A mech's item conditions, by the sheet field that holds them (`ItemConditionMapSchema`). */
export const CONDITIONS = {
  systemConditions: resolveSystemRef,
  moduleConditions: resolveModuleRef,
} as const

/** A system or module's new condition, in the line's words. */
export const CONDITION_WORDS: Readonly<Record<string, string>> = {
  intact: 'is repaired',
  damaged: 'is damaged',
  destroyed: 'is destroyed',
}

/** What a stored event row carries beside its line. */
export type Stored = {
  kind: TableEventKind
  text: string
  /** What a repeat is matched on; absent once sealed, or for a line that never merges. */
  key?: string
  /** The key whose open line this one ends: a hit on a vital, which no nudge folds across. */
  ends?: string
  /** A vital's line, kept apart so a repeat can rewrite it. */
  vital?: VitalChange
  /** How many times the line repeated. */
  n?: number
  /** The line before its count. */
  base?: string
  private?: true
  session?: 'start' | 'end'
  answer?: 'accepted' | 'undone'
  about?: string
  /**
   * The names the line was written with (r6 A9): the actor's, by name and as
   * the table's runner, and the name of whom it is about. Read back, each is
   * the member's name now (`namedNow`).
   */
  said?: { by?: [string, string]; about?: string }
}

/** How a member is named now: by name, and as the runner of the table's own acts. */
export type NamesNow = (userId: string) => { name: string; runner: string } | null

/**
 * A line as it reads today (r6 A9): the actor and whom it is about under the
 * names they go by now, not the ones they had. After a hand-over, the former
 * Mediator's "Mediator ended the group session" reads under their own name.
 */
export function namedNow(stored: Stored, actorId: string | null, now: NamesNow): Stored {
  const said = stored.said
  if (said === undefined) return stored
  let text = stored.text
  const actor = actorId === null ? null : now(actorId)
  if (said.by !== undefined && actor !== null) {
    const [name, runner] = said.by
    if (runner !== actor.runner && text.startsWith(`${runner} `))
      text = `${actor.runner}${text.slice(runner.length)}`
    else if (name !== actor.name && text.startsWith(`${name} `))
      text = `${actor.name}${text.slice(name.length)}`
  }
  const about = stored.about === undefined ? null : now(stored.about)
  if (said.about !== undefined && about !== null && about.name !== said.about)
    text = text.replace(said.about, about.name)
  return text === stored.text ? stored : { ...stored, text }
}

/** How a Mediator's screen signs the rolls it logs (`PlayMediatorCockpit`'s `rollerName`). */
const MEDIATOR_SIGNED = 'Mediator · '

/**
 * A roll's line under the name of whoever rolled it (r3 A2, r7 A6): one a
 * Mediator's screen signed "Mediator" reads under its roller's name, so the
 * Feed names people, never their role. Their own screen is served the line
 * as logged, and says "You" (`feed.model.ts`).
 */
export function signedBy(line: string, rollerName: string | null): string {
  if (!line.startsWith(MEDIATOR_SIGNED) || rollerName === null) return line
  return `${rollerName} · ${line.slice(MEDIATOR_SIGNED.length)}`
}

/** What a switched effect is called: the system, module or ability that declares it. */
export function effectName(ref: string): string {
  try {
    const item = resolveInstalledRef(ref) as { name?: string } | null
    return item?.name ?? SalvageUnionReference.Abilities.getBySlug(ref)?.name ?? ref
  } catch {
    return ref
  }
}

/**
 * The source of an op a toast's Undo wrote (`replica/provenance.ts`'s
 * `PLAY_UNDO`): its line says so, so the table reads a hit taken back as
 * taken back, never as a second change (r3 B2).
 */
export const UNDO_SOURCE = 'play-undo'

/**
 * Whether an op is an Undo: a Play toast's, or a sheet's own (`sheetUndo`,
 * `live-sheet-undo:<change id>`). Only one of these takes an accepted proposal
 * back (r5 A2): a heal that reaches the old value is a heal.
 */
export function isUndoSource(source: string): boolean {
  return source === UNDO_SOURCE || source.startsWith('live-sheet-undo:')
}

/** A vital's change as an event stores it. */
export type VitalChange = {
  who: string
  label: string
  from: number | null
  to: number
  undo?: true
  /** The unit it changed: whose screen toasts it, when another member did it (r6 A3). */
  unitId?: string
}

export function vitalLine(v: VitalChange): string {
  const line =
    v.from === null
      ? `${v.who} · ${v.label} → ${v.to}`
      : `${v.who} · ${v.label} ${v.from} → ${v.to}`
  return v.undo === true ? `${line} · Undo` : line
}

/**
 * A unit as a vital's line names it: a mech (`label`) with its pilot, "Reaper
 * (GHOST)", whoever is aboard, else whoever it is assigned to (r3 B2).
 */
export function crewedLabel(store: GameStore, unitId: string, label: string): string {
  if (store.unit(unitId)?.kind !== 'mech') return label
  const aboard = store
    .rows('select * from seats')
    .map(seatOf)
    .find((seat) => seat.mount.kind === 'boarded' && seat.mount.mechId === unitId)?.pilotId
  const pilotId =
    aboard ?? store.linksTouching(unitId).find((link) => link.type === 'mech-to-pilot')?.to.id
  const pilot = pilotId === undefined ? null : store.unit(pilotId)
  return pilot === null ? label : `${label} (${pilotCallsign(pilot.body)})`
}

/** A repeat folded into the line it follows: a vital keeps where it started, any other line counts. */
export function mergeLine(open: Stored, next: Stored): Stored {
  if (open.vital !== undefined && next.vital !== undefined) {
    const vital = { ...next.vital, from: open.vital.from }
    return { ...open, vital, text: vitalLine(vital) }
  }
  const n = (open.n ?? 1) + 1
  const base = open.base ?? open.text
  return { ...open, n, base, text: `${base} ×${n}` }
}

export function eventOf(
  id: string,
  ts: number,
  actorId: string | null,
  stored: Stored
): TableEvent {
  return {
    _id: id,
    ts,
    kind: stored.kind,
    text: stored.text,
    actorId,
    ...(stored.private === true ? { private: true as const } : {}),
    ...(stored.session === undefined ? {} : { session: stored.session }),
    ...(stored.answer === undefined ? {} : { answer: stored.answer }),
    ...(stored.about === undefined ? {} : { about: stored.about }),
    // What a vital's line changed, for a session's recap (r6 C1).
    ...(stored.vital === undefined ? {} : { vital: stored.vital }),
  }
}

/**
 * How the room names a member now (r7 A6): by name, else their place in the
 * joining order ("Player 2", `memberName`), as the Game page's Members does;
 * never by a role. The runner of the table's own acts (`events.ts`) goes by
 * the same name: the role is said only where it is the news ("Sam now
 * mediates"). Null for someone no longer a member.
 */
export function namesOf(store: GameStore): NamesNow {
  return (userId) => {
    const members = store.members()
    const at = members.findIndex((member) => member.userId === userId)
    const member = members[at]
    if (member === undefined) return null
    const name = memberName(member.displayName, at)
    return { name, runner: name }
  }
}

/** A line with the names it is written with, kept so it reads under today's (r6 A9). */
export function withSaid(now: NamesNow, actor: string | null, line: Stored): Stored {
  const by = actor === null ? null : now(actor)
  const about = line.about === undefined ? null : now(line.about)
  if (by === null && about === null) return line
  return {
    ...line,
    said: {
      ...(by === null ? {} : { by: [by.name, by.runner] }),
      ...(about === null ? {} : { about: about.name }),
    },
  }
}
