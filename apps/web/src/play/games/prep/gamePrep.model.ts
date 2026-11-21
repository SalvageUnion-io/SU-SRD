/**
 * A Game's Prep, as its page reads it (ADR-067 §3-4): which of the Mediator's
 * encounters are this Game's and in what order, and the plan's sessions as a
 * dated list. Pure.
 */

import { gamePath } from 'game-domain/entityKinds'
import type { Encounter } from 'game-domain/schemas/encounter'
import type { GamePlan, PlanSession } from 'game-domain/schemas/gamePlan'

/** The Mediator's Kit, on the Games front: every NPC and encounter, across Games. */
export const KIT_PATH = '/games/#mediators-kit'

/** A Game's Prep, under its page: `/games/<gameId>/prep`. */
export function gamePrepPath(gameId: string): string {
  return `${gamePath(gameId)}/prep`
}

type Ordered = Pick<Encounter, 'id' | 'gameId' | 'order' | 'createdAt'>

/**
 * This Game's encounters in their order: lowest `order` first, one with none
 * after them all, in the order they were made.
 */
export function gameEncounters<E extends Ordered>(encounters: readonly E[], gameId: string): E[] {
  return encounters
    .filter((e) => e.gameId === gameId)
    .sort(
      (a, b) =>
        (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) ||
        a.createdAt.localeCompare(b.createdAt)
    )
}

/** The encounters prepared for no Game: the ones this Game can take in. */
export function looseEncounters<E extends Pick<Encounter, 'gameId'>>(
  encounters: readonly E[]
): E[] {
  return encounters.filter((e) => e.gameId === undefined)
}

/** The `order` a new last encounter takes. */
export function lastOrder(inGame: readonly Pick<Encounter, 'order'>[]): number {
  return inGame.reduce((most, e) => Math.max(most, e.order ?? 0), 0) + 1
}

/**
 * Move one encounter a place up or down the Game's list: the `order` each
 * encounter must now carry, only for those whose place changed. The list is
 * renumbered from 1, so one made before orders existed takes its place too.
 */
export function moveEncounter(
  inGame: readonly Ordered[],
  id: string,
  by: -1 | 1
): { id: string; order: number }[] {
  const at = inGame.findIndex((e) => e.id === id)
  const to = at + by
  if (at < 0 || to < 0 || to >= inGame.length) return []
  const next = [...inGame]
  const [moved] = next.splice(at, 1)
  if (moved === undefined) return []
  next.splice(to, 0, moved)
  return next.flatMap((e, i) => (e.order === i + 1 ? [] : [{ id: e.id, order: i + 1 }]))
}

/** The sessions by their day, soonest first; one with no day set comes last, as written. */
export function datedSessions(plan: Pick<GamePlan, 'sessions'>): PlanSession[] {
  return plan.sessions
    .map((session, i) => ({ session, i }))
    .sort((a, b) => {
      if (a.session.date === undefined || b.session.date === undefined) {
        return a.session.date === b.session.date ? a.i - b.i : a.session.date === undefined ? 1 : -1
      }
      return a.session.date.localeCompare(b.session.date) || a.i - b.i
    })
    .map(({ session }) => session)
}

/** The plan with one session changed, in place. A blank day or title is unset. */
export function patchSession(
  plan: GamePlan,
  id: string,
  patch: { date?: string; title?: string; note?: string }
): GamePlan {
  return {
    ...plan,
    sessions: plan.sessions.map((s) => {
      if (s.id !== id) return s
      const { date, title, ...rest } = { ...s, ...patch }
      return { ...rest, ...(date ? { date } : {}), ...(title?.trim() ? { title } : {}) }
    }),
  }
}

/** The plan with a new, empty session on `date` (today, as the Mediator's clock has it). */
export function addSession(plan: GamePlan, id: string, date: string): GamePlan {
  return { ...plan, sessions: [...plan.sessions, { id, date, note: '' }] }
}

/** The plan without one session. */
export function removeSession(plan: GamePlan, id: string): GamePlan {
  return { ...plan, sessions: plan.sessions.filter((s) => s.id !== id) }
}

/** A session as a line names it: its title, else its day, else "Session". */
export function sessionName(session: Pick<PlanSession, 'title' | 'date'>): string {
  return session.title?.trim() || session.date || 'Session'
}
