/**
 * One text field that saves itself (r6 B2, MD6-02): typing edits a draft that
 * is saved a moment after typing stops, when the field is left, and when the
 * page is hidden or left, as the Game's notes and session plans in Prep save
 * (`usePlanDraft`). A refresh or a closed tab never loses what was typed.
 * `state` says whether it is kept.
 *
 * `schedule` is the timer (a test hands in its own, so it never waits on a
 * real one).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** How long typing rests before the draft is saved: the plan's pace. */
export const TEXT_AUTOSAVE_MS = 800

export type TextSaveState = 'saving' | 'saved' | 'failed'

type Schedule = (run: () => void, ms: number) => () => void

const realSchedule: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}

export function useAutosavedText({
  kept,
  save,
  schedule = realSchedule,
}: {
  /** The value as stored. */
  kept: string
  /** Keep the text; rejects when refused (the caller has said why). */
  save: (text: string, leaving: boolean) => Promise<unknown>
  schedule?: Schedule
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [state, setState] = useState<TextSaveState | null>(null)
  const latest = useRef<string | null>(null)
  const dirty = useRef(false)
  const cancel = useRef<(() => void) | null>(null)
  // The save as last rendered: `flush` stays one function, so leaving is its only cleanup.
  const saveNow = useRef(save)
  saveNow.current = save

  /** Save what is typed, if anything is unsaved. `leaving`: the page is going. */
  const flush = useCallback((leaving = false) => {
    cancel.current?.()
    cancel.current = null
    const text = latest.current
    if (!dirty.current || text === null) return
    dirty.current = false
    let saving: Promise<unknown>
    try {
      saving = saveNow.current(text, leaving)
    } catch {
      dirty.current = true
      setState('failed')
      return
    }
    saving.then(
      () => {
        if (!dirty.current) setState('saved')
      },
      () => {
        // Still unsaved: the next edit, blur or leave tries again.
        if (latest.current === text) dirty.current = true
        setState('failed')
      }
    )
  }, [])

  /** Typing: the draft changes now and is saved once typing rests. */
  const change = (text: string) => {
    latest.current = text
    dirty.current = true
    setDraft(text)
    setState('saving')
    cancel.current?.()
    cancel.current = schedule(() => flush(), TEXT_AUTOSAVE_MS)
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
      // Leaving for another page of the app (or Read): save what is still unsaved.
      flush()
    }
  }, [flush])

  return { value: draft ?? kept, state, change, flush }
}
