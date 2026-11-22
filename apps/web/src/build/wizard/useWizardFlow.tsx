/**
 * useWizardFlow — the step machine, the create submit and the `WizShell`
 * navigation props the pilot, mech, crawler and NPC wizards all run.
 *
 * Submit validates the create input against the entity's Zod schema (with a
 * throwaway `id` — the store mints the real one), surfaces the joined issue
 * messages as one `Validation error: …` string, then creates, toasts, clears
 * the session draft and hands the new id to `onComplete`.
 *
 * What differs per wizard stays with the caller: `toCreateInput` is a closure,
 * so the crawler derives its starting SP and seeds its base bays inside its
 * own, and `failureMessage` is passed verbatim because the wizards'
 * failure copy differs.
 *
 * `shell` is every `WizShell` prop the wizards share
 * (stepper, Back / Next / Cancel, the step gate and the Off-Rules escape);
 * each wizard spreads it and adds only its own kind, copy and trackers.
 *
 * Leaving a unit's wizard any way but Create or Cancel (a nav link, the
 * browser's Back) keeps its draft, and says so once, by toast: the Training
 * Bay offers it back (`WizardDrafts`).
 */

import { moveTo } from 'game-domain/container'
import type { EntityKind } from 'game-domain/entityKinds'
import { startTransition, useEffect, useRef, useState } from 'react'
import { toast } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { downloadJson, exportFileName } from '../../lib/export/downloadJson'
import { draftExportBundle } from '../../lib/export/draftExport'
import type { StepGateResult } from '../../lib/rules/creation'
import { wizardDraftSummary } from '../../lib/wizard/draftSummary'
import {
  clearWizardDraft,
  readWizardReached,
  writeWizardReached,
} from '../../lib/wizard/wizardDraft'
import { buildWizardCopy } from '../../messages/build-wizard'
import { useSync } from '../../replica/syncContext'
import type { CreateInput } from '../../replica/types'
import { useUnits } from '../../replica/units'
import type { KeepAsFileActs } from './KeepAsFile'

/**
 * The slice of a Zod object schema this hook uses.
 *
 * Deliberately structural rather than `ZodType`: the hook only ever asks
 * "did it parse, and if not what were the messages", and typing it that way
 * keeps the wizards free to hand over their own schema without the hook
 * having an opinion about the parsed shape.
 */
type WizardValidationSchema = {
  safeParse: (value: unknown) => {
    success: boolean
    error?: { issues: readonly { message: string }[] }
  }
}

export type WizardFlowOptions<
  TStep extends string,
  TForm extends { name: string },
  T extends EntityKind,
> = {
  entityType: T
  /** Noun used in the success toast when the form has no name yet. */
  noun: string
  /** The wizard's steps, in order. */
  steps: readonly TStep[]
  /** Stepper-rail label per step. */
  stepLabels: Record<TStep, string>
  /** The hard creation gate for a step; a failing gate locks Next. */
  gateFor: (step: TStep) => StepGateResult
  /** First step. */
  initialStep: TStep
  /** The step whose Next is a submit rather than an advance. */
  submitStep: TStep
  form: TForm
  /** Session-draft key, cleared on a successful submit or a cancel. */
  draftKey: string
  /** Whether the form differs from empty — Cancel asks before discarding it. */
  formDirty: boolean
  /** Validated with a throwaway id before the create write. */
  schema: WizardValidationSchema
  toCreateInput: (form: TForm) => CreateInput<T>
  /** Copy shown when the write fails with a defect. Verbatim — each wizard's own. */
  failureMessage: string
  /** Called with the new entity's id once the create has landed. */
  onComplete: (entityId: string) => void
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path; offered on a locked step. */
  onOffRules?: () => void
  /**
   * The Game the new unit lands in: a wizard started from a Game's page
   * (`?game=<id>`, ADR-052 §3). Unset, the store decides.
   */
  gameId?: string | undefined
  /**
   * The saved unit this run redesigns (the NPC designer's Edit design): Save
   * validates the form the same way, then hands it to `save`, which writes
   * that unit in place, and nothing is created. The unit is already whole, so
   * every step is reached from the start and each one saves (MD3-06).
   */
  existing?: { id: string; save: (form: TForm) => Promise<unknown> } | undefined
}

/** The `WizShell` props every creation wizard passes the same way. */
type WizardShellProps = {
  steps: readonly string[]
  active: number
  /** The furthest step reached: every step up to it is a way there. */
  reached: number
  onStepClick: (index: number) => void
  onEscape: (() => void) | undefined
  onBack: (() => void) | undefined
  onCancel: () => void
  confirmCancel: boolean
  /** Advance, or submit when already on `submitStep`. */
  onNext: () => void
  /** Redesigning a saved unit: save from the step it is on, whichever that is. */
  saveNow: (() => void) | undefined
  nextDisabled: boolean
  busy: boolean
  /** Saving signed out asks for an account; the draft is kept (`SaveSignInDialog`). */
  signIn: { open: boolean; onClose: () => void }
  /** Signed out, the first step says up front that saving needs a sign-in. */
  tryNote: string | undefined
  /** Signed out on the submit step: keep the build as a file, or print it. */
  keepAsFile: KeepAsFileActs | undefined
}

export type WizardFlow<TStep extends string> = {
  step: TStep
  /** `gateFor(step)`. */
  gate: StepGateResult
  submitError: string | null
  /** Spread onto `WizShell`. */
  shell: WizardShellProps
  /** Signed out: open the shell's "Sign in to save" (a step's own save asks as Create does); else undefined. */
  askSignIn: (() => void) | undefined
}

export function useWizardFlow<
  TStep extends string,
  TForm extends { name: string },
  T extends EntityKind,
>({
  entityType,
  noun,
  steps,
  stepLabels,
  gateFor,
  initialStep,
  submitStep,
  form,
  draftKey,
  formDirty,
  schema,
  toCreateInput,
  failureMessage,
  onComplete,
  onCancel,
  onOffRules,
  gameId,
  existing,
}: WizardFlowOptions<TStep, TForm, T>): WizardFlow<TStep> {
  // A reload reopens at the furthest step the draft reached, short of the
  // first step whose gate its picks no longer pass.
  const [step, setStep] = useState<TStep>(() => {
    const start = Math.max(steps.indexOf(initialStep), 0)
    const stored = Math.min(readWizardReached(draftKey), steps.length - 1)
    let at = Math.max(start, stored)
    for (let i = start; i < at; i++) {
      const s = steps[i]
      if (s && !gateFor(s).ok) at = i
    }
    return steps[at] ?? initialStep
  })
  const [reached, setReached] = useState(() =>
    existing === undefined ? Math.max(steps.indexOf(step), 0) : steps.length - 1
  )
  // The form's own words for what it is missing; a failed write is `save.error`.
  const [invalid, setInvalid] = useState<string | null>(null)
  // A wizard runs signed out; Save is where an account is asked for. The form
  // is already this tab's session draft, so signing in comes back to it.
  const { status, canWrite } = useSync()
  const [askSignIn, setAskSignIn] = useState(false)

  const currentIndex = steps.indexOf(step)

  // Left with a draft kept (not created, not cancelled): said as it happens.
  // The check waits a microtask, so a remount in the same commit says nothing.
  const leaving = useRef({ mounted: false, settled: false, dirty: formDirty })
  leaving.current.dirty = formDirty
  useEffect(() => {
    const state = leaving.current
    state.mounted = true
    return () => {
      state.mounted = false
      queueMicrotask(() => {
        if (state.mounted || state.settled || !state.dirty || entityType === 'npc') return
        const draft = wizardDraftSummary(entityType)
        if (draft) toast.info(buildWizardCopy('draftKept', { label: draft.label }))
      })
    }
  }, [entityType])

  useEffect(() => {
    if (currentIndex > reached) setReached(currentIndex)
  }, [currentIndex, reached])
  useEffect(() => {
    if (reached > 0) writeWizardReached(draftKey, reached)
  }, [draftKey, reached])

  const save = useServerAction(
    async () => {
      const now = new Date().toISOString()
      const rawInput = toCreateInput(form)

      // Validate against the entity schema before submitting (surface errors
      // in-UI). `id` is a throwaway: the store mints the real one.
      const validation = schema.safeParse({
        ...rawInput,
        id: 'temp-validate-only',
        createdAt: now,
        updatedAt: now,
      })
      if (!validation.success) {
        const messages = (validation.error?.issues ?? []).map((e) => e.message).join('; ')
        setInvalid(buildWizardCopy('validationError', { messages }))
        return null
      }

      if (existing !== undefined) {
        await existing.save(form)
        return { id: existing.id }
      }
      return useUnits
        .getState()
        .create(entityType, gameId === undefined ? rawInput : inGame(rawInput, gameId))
    },
    { failure: failureMessage }
  )

  const signedOut = status === 'signedOut' && !canWrite

  /**
   * The build as a file, for a reader with no account (`draftExportBundle`):
   * validated as Save validates it, and the Training Bay's Import… reads it.
   */
  const fileName = exportFileName(entityType, form.name.trim() || noun)
  function download(): boolean {
    if (entityType === 'npc') return false
    setInvalid(null)
    const now = new Date().toISOString()
    const input = toCreateInput(form)
    const validation = schema.safeParse({
      ...input,
      id: 'temp-validate-only',
      createdAt: now,
      updatedAt: now,
    })
    if (!validation.success) {
      const messages = (validation.error?.issues ?? []).map((e) => e.message).join('; ')
      setInvalid(buildWizardCopy('validationError', { messages }))
      return false
    }
    downloadJson(fileName, draftExportBundle(entityType, input, now))
    return true
  }

  async function handleSubmit() {
    setInvalid(null)
    if (signedOut) {
      setAskSignIn(true)
      return
    }
    const result = await save.run()
    if (!result.ok || result.value === null) return
    toast.success(buildWizardCopy('saved', { value: form.name.trim() || noun }))
    leaving.current.settled = true
    clearWizardDraft(draftKey)
    onComplete(result.value.id)
  }

  // A step change is a transition: the next step (a class's ability tree, the
  // systems list) renders in slices behind the pressed button, so the press
  // paints at once rather than after one long render (INP).
  function goTo(next: TStep) {
    // A step forward is a history entry of its own, so the browser's Back is
    // one step back (below); a step back rewrites the entry it is on.
    const to = steps.indexOf(next)
    if (typeof window !== 'undefined' && to >= 0) {
      const write = to > currentIndex ? 'pushState' : 'replaceState'
      window.history[write](window.history.state, '', stepHash(to))
    }
    startTransition(() => setStep(next))
  }

  // The browser's Back and Forward land on an entry's step, where the draft
  // has reached it; the entry the wizard opened on is its first step.
  const reachedRef = useRef(reached)
  reachedRef.current = reached
  useEffect(() => {
    const first = Math.max(steps.indexOf(initialStep), 0)
    const onPop = () => {
      const at = stepOfHash(window.location.hash) ?? first
      const s = steps[Math.min(at, reachedRef.current)]
      if (s) startTransition(() => setStep(s))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [steps, initialStep])

  function goNext() {
    if (step === submitStep) {
      void handleSubmit()
      return
    }
    const next = steps[currentIndex + 1]
    if (next) goTo(next)
  }

  function goBack() {
    const prev = steps[currentIndex - 1]
    if (currentIndex > 0 && prev) {
      goTo(prev)
    }
  }

  const gate = gateFor(step)
  // A step ahead is open only while every gate before it passes.
  let open = Math.max(reached, currentIndex)
  for (let i = currentIndex; i < open; i++) {
    const s = steps[i]
    if (s && !gateFor(s).ok) open = i
  }

  return {
    step,
    gate,
    submitError: invalid ?? save.error,
    askSignIn: signedOut ? () => setAskSignIn(true) : undefined,
    shell: {
      steps: steps.map((s) => stepLabels[s]),
      active: currentIndex,
      reached: open,
      onStepClick: (i) => {
        const s = steps[i]
        if (s && i <= open) goTo(s)
      },
      onEscape: !gate.ok && onOffRules ? onOffRules : undefined,
      onBack: currentIndex > 0 ? goBack : undefined,
      onCancel: () => {
        leaving.current.settled = true
        clearWizardDraft(draftKey)
        onCancel()
      },
      confirmCancel: formDirty,
      onNext: goNext,
      saveNow: existing === undefined ? undefined : () => void handleSubmit(),
      nextDisabled: !gate.ok,
      busy: save.pending,
      signIn: { open: askSignIn, onClose: () => setAskSignIn(false) },
      tryNote: signedOut && currentIndex === 0 ? buildWizardCopy('tryItNow') : undefined,
      keepAsFile:
        signedOut && step === submitStep && entityType !== 'npc'
          ? { fileName, onDownload: download, onPrint: () => window.print() }
          : undefined,
    },
  }
}

/** A step's history entry: its number in the address's fragment (`#step-2`). */
const stepHash = (index: number) => `#step-${index + 1}`
const stepOfHash = (hash: string): number | undefined => {
  const match = /^#step-(\d+)$/.exec(hash)
  return match ? Number(match[1]) - 1 : undefined
}

/** A create input filed under a Game: its container decided, so the store keeps it. */
function inGame<I>(input: I, gameId: string): I {
  return { ...input, ...moveTo({ kind: 'game', gameId }) }
}
