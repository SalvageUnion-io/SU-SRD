/**
 * The Mediator's plan as it is typed (MD4-01): a draft that saves itself a
 * moment after typing stops, when a field is left, and when the page is
 * hidden or left, so a note is never lost to a refresh, a locked phone or a
 * closed tab. `sign` says where the last edit was and whether it is kept.
 */

import type { GamePlan } from 'game-domain/schemas/gamePlan'
import { useCallback, useEffect, useRef, useState } from 'react'
import { reportWriteFailure } from '../../../lib/runWrite'
import { useGamesCall } from '../../../replica/roomCalls'

/** How long typing rests before the draft is saved. */
export const PLAN_AUTOSAVE_MS = 800

/** Where the last edit was (`notes`, or a session's id) and how far its save has got. */
export type PlanSaveSign = { at: string; state: 'saving' | 'saved' | 'failed' }

export function usePlanDraft(gameId: string) {
  const save = useGamesCall('plan.set', { gameId })
  // What the Mediator has typed since the plan arrived; it wins over the kept copy.
  const [draft, setDraft] = useState<GamePlan | null>(null)
  const [sign, setSign] = useState<PlanSaveSign | null>(null)
  const latest = useRef<GamePlan | null>(null)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The call as last rendered: `flush` stays one function, so leaving the page is its only cleanup.
  const saveNow = useRef(save)
  saveNow.current = save

  /** Save what is typed, if anything is unsaved. `leaving`: the page is going, so the request must outlive it. */
  const flush = useCallback((leaving = false) => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    const plan = latest.current
    if (!dirty.current || plan === null) return
    dirty.current = false
    const settle = (state: PlanSaveSign['state']) =>
      setSign((was) => (was === null || dirty.current ? was : { ...was, state }))
    try {
      void saveNow.current({ plan }, leaving ? { keepalive: true } : undefined).then(
        () => settle('saved'),
        (err: unknown) => {
          // Still unsaved: the next edit, blur or leave tries again.
          if (latest.current === plan) dirty.current = true
          setSign((was) => (was === null ? was : { ...was, state: 'failed' }))
          reportWriteFailure(err)
        }
      )
    } catch (err) {
      reportWriteFailure(err)
    }
  }, [])

  /** Typing: the draft changes now and is saved once typing rests. */
  const edit = (next: GamePlan, at: string) => {
    latest.current = next
    dirty.current = true
    setDraft(next)
    setSign({ at, state: 'saving' })
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(flush, PLAN_AUTOSAVE_MS)
  }

  /** A change that is whole at once (a session added): kept at once. */
  const write = (next: GamePlan) => {
    latest.current = next
    dirty.current = true
    setDraft(next)
    flush()
  }

  /** A change its caller saves itself (a confirmed removal): the draft follows, nothing is queued. */
  const replace = (next: GamePlan) => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    latest.current = next
    dirty.current = false
    setDraft(next)
  }

  useEffect(() => {
    const leave = () => flush(true)
    const hidden = () => {
      if (document.visibilityState === 'hidden') leave()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', leave)
      // Leaving for another page of the app: save what is still unsaved.
      flush()
    }
  }, [flush])

  return { draft, sign, edit, write, replace, flush, save }
}
