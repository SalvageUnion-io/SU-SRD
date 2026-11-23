/**
 * useInitiative — the Group Initiative tracker on Mediate (r6 B4): the room's
 * one record of it (`mediator.initiative`), and the Mediator's moves on it.
 * Each move sends the whole tracker; a refusal is said, and nothing waits on
 * it (a marker, as Give the turn is).
 *
 * Turns run themselves (r7 C3, `TURNS_RUN_THEMSELVES`): an NPC's rolled action
 * marks it Acted (`markActed`), and a side all acted passes play on
 * (`passedSide`), at once when the screen marks it and, for a pilot's End my
 * turn, as the tracker reads it (`usePassingSides`). The last automatic step
 * is kept per Game (`lastStep`), so the tracker can offer its Undo; undone,
 * that state is held and never passed on again by itself.
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { Initiative, InitiativeSide } from '../../lib/rules/initiative'
import { withActed } from '../../lib/rules/initiative'
import { useTableAct, useTableRead } from '../../replica/useTable'
import type { SidesOf } from './initiative.model'
import { mediatorSides, passedSide, TURNS_RUN_THEMSELVES } from './initiative.model'

/** An automatic step: the tracker before it and after, and who acted, if a unit did. */
export type AutoStep = { before: Initiative; after: Initiative; acted?: string; passedTo?: string }

const steps = new Map<string, AutoStep>()
/** A state the Mediator undid back to: it stays as it is until they move it. */
const held = new Map<string, string>()
const listeners = new Set<() => void>()
/** One spelling of a tracker state, whatever order the room keeps its fields and marks in. */
const keyOf = (initiative: Initiative) =>
  JSON.stringify([initiative.round, initiative.side ?? null, [...initiative.acted].sort()])

function noteStep(gameId: string, step: AutoStep | null): void {
  if (step === null) steps.delete(gameId)
  else steps.set(gameId, step)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The tracker after `id` acted, passed on when their side is done; null when it is not kept. */
export function actedAndPassed(
  initiative: Initiative,
  id: string,
  sides: readonly InitiativeSide[]
): Initiative {
  const marked = withActed(initiative, id, true)
  return passedSide(marked, sides) ?? marked
}

export type InitiativeTracker = {
  /** The tracker kept; null when none is (or while it loads). */
  initiative: Initiative | null
  /** The sides as the tracker keeps them: one Opposition, but for the groups split off (r7 C4). */
  sides: readonly InitiativeSide[]
  /** Keep it as moved, or end it with null. */
  set: (next: Initiative | null) => void
  /** Mark one seat or unit as having acted this round, or not. */
  setActed: (id: string, acted: boolean) => void
  /** The app's own mark (an NPC's rolled action): Acted, and the side passed when done. */
  markActed: (id: string) => void
  /** The last automatic step, while the tracker still stands where it left it. */
  lastStep: AutoStep | null
  /** Put the tracker back as it was before the last automatic step. */
  undoStep: () => void
  /** The app passing the side on by itself (`usePassingSides`), kept as the last step. */
  pass: (before: Initiative, after: Initiative) => void
}

export function useInitiative(
  gameId: string,
  onFailure: (err: unknown) => void,
  /** Whose sides they are: the seats and the units standing (`mediatorSides`). */
  table?: SidesOf
): InitiativeTracker {
  const initiative = useTableRead('mediator.initiative', { gameId }) ?? null
  const sides = table === undefined ? [] : mediatorSides(table, initiative?.split)
  const act = useTableAct('mediator.setInitiative', gameId)
  const send = (next: Initiative | null) => {
    act({ initiative: next }).catch(onFailure)
  }
  // The Mediator's own move stands as they left it: nothing passes it on by itself.
  const set = (next: Initiative | null) => {
    if (next === null) held.delete(gameId)
    else held.set(gameId, keyOf(next))
    send(next)
  }
  const step = useSyncExternalStore(
    subscribe,
    () => steps.get(gameId),
    () => undefined
  )
  const lastStep =
    step !== undefined && initiative !== null && keyOf(step.after) === keyOf(initiative)
      ? step
      : null
  const auto = (before: Initiative, after: Initiative, acted?: string) => {
    const passedTo = after.side !== before.side ? after.side : undefined
    noteStep(gameId, {
      before,
      after,
      ...(acted === undefined ? {} : { acted }),
      ...(passedTo === undefined ? {} : { passedTo }),
    })
    send(after)
  }
  return {
    initiative,
    sides,
    set,
    setActed: (id, acted) => {
      if (initiative === null) return
      // A mark the Mediator sets passes the side too; one they clear never does.
      if (acted && TURNS_RUN_THEMSELVES) {
        const after = actedAndPassed(initiative, id, sides)
        if (after.side !== initiative.side) return auto(initiative, after)
        return send(after)
      }
      send(withActed(initiative, id, acted))
    },
    markActed: (id) => {
      if (!TURNS_RUN_THEMSELVES || initiative === null || initiative.acted.includes(id)) return
      auto(initiative, actedAndPassed(initiative, id, sides), id)
    },
    lastStep,
    undoStep: () => {
      if (lastStep === null) return
      noteStep(gameId, null)
      set(lastStep.before)
    },
    pass: (before, after) => {
      noteStep(gameId, {
        before,
        after,
        ...(after.side === undefined ? {} : { passedTo: after.side }),
      })
      send(after)
    },
  }
}

/**
 * Pass the side on as the tracker reads it (r7 C3): a pilot's End my turn
 * marks them Acted in the room, and the side moves here, on the Mediator's
 * screen, with the same Undo. A state the Mediator set or undid to is left alone.
 */
export function usePassingSides(gameId: string, tracker: InitiativeTracker, live: boolean): void {
  const { initiative, sides } = tracker
  const passed = initiative === null ? null : passedSide(initiative, sides)
  const key = initiative === null ? '' : keyOf(initiative)
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the tracker's state, which `key` spells; `tracker` is rebuilt every render
  useEffect(() => {
    if (!live || initiative === null || passed === null) return
    if (held.get(gameId) === key) return
    tracker.pass(initiative, passed)
  }, [live, key, passed?.side, gameId])
}
