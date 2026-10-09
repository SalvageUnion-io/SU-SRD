/**
 * useWizardFlow — the step machine, the create submit and the `WizShell`
 * navigation props the pilot, mech and crawler wizards all run.
 *
 * Submit validates the create input against the entity's Zod schema (with a
 * throwaway `id` — the store mints the real one), surfaces the joined issue
 * messages as one `Validation error: …` string, then creates, toasts, clears
 * the session draft and hands the new id to `onComplete`.
 *
 * What differs per wizard stays with the caller: `toCreateInput` is a closure,
 * so the crawler derives its starting SP and seeds its base bays inside its
 * own, and `failureMessage` is passed verbatim because the three wizards'
 * failure copy differs.
 *
 * `shell` is every `WizShell` prop the three wizards share
 * (stepper, Back / Next / Cancel, the step gate and the Off-Rules escape);
 * each wizard spreads it and adds only its own kind, copy and trackers.
 */

import { toast } from 'component-lib'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { StepGateResult } from '../../lib/rules/creation'
import { clearWizardDraft } from '../../lib/wizard/wizardDraft'
import { useEntityStore } from '../../stores/entityStore'
import type { AssignableType, CreateInput } from '../../stores/types'
import { OffRulesEscape } from './OffRulesEscape'

/**
 * The slice of a Zod object schema this hook uses.
 *
 * Deliberately structural rather than `ZodType`: the hook only ever asks
 * "did it parse, and if not what were the messages", and typing it that way
 * keeps the three wizards free to hand over their own schema without the hook
 * having an opinion about the parsed shape.
 */
export type WizardValidationSchema = {
  safeParse: (value: unknown) => {
    success: boolean
    error?: { issues: readonly { message: string }[] }
  }
}

export type WizardFlowOptions<
  TStep extends string,
  TForm extends { name: string },
  T extends AssignableType,
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
  /** Copy shown when the write throws. Verbatim — the three differ. */
  failureMessage: string
  /** Called with the new entity's id once the create has landed. */
  onComplete: (entityId: string) => void
  onCancel: () => void
  /** Leaves the guided flow for the blank Free-Edit path; offered on a locked step. */
  onOffRules?: () => void
}

/** The `WizShell` props every creation wizard passes the same way. */
export type WizardShellProps = {
  steps: readonly string[]
  active: number
  onStepClick: (index: number) => void
  tintedStepCard: true
  escapeAction: ReactNode
  onBack: (() => void) | undefined
  onCancel: () => void
  confirmCancel: boolean
  /** Advance, or submit when already on `submitStep`. */
  onNext: () => void
  nextDisabled: boolean
  busy: boolean
}

export type WizardFlow<TStep extends string> = {
  step: TStep
  /** `gateFor(step)`. */
  gate: StepGateResult
  submitError: string | null
  /** Spread onto `WizShell`. */
  shell: WizardShellProps
}

export function useWizardFlow<
  TStep extends string,
  TForm extends { name: string },
  T extends AssignableType,
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
}: WizardFlowOptions<TStep, TForm, T>): WizardFlow<TStep> {
  const [step, setStep] = useState<TStep>(initialStep)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentIndex = steps.indexOf(step)

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const store = useEntityStore.getState()
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
        setSubmitError(`Validation error: ${messages}`)
        setIsSubmitting(false)
        return
      }

      const created = await store.create(entityType, rawInput)
      toast.success(`Saved ${form.name.trim() || noun}.`)
      clearWizardDraft(draftKey)
      onComplete(created.id)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : failureMessage)
      setIsSubmitting(false)
    }
  }

  function goNext() {
    if (step === submitStep) {
      void handleSubmit()
      return
    }
    const next = steps[currentIndex + 1]
    if (next) setStep(next)
  }

  function goBack() {
    const prev = steps[currentIndex - 1]
    if (currentIndex > 0 && prev) {
      setStep(prev)
    }
  }

  const gate = gateFor(step)

  return {
    step,
    gate,
    submitError,
    shell: {
      steps: steps.map((s) => stepLabels[s]),
      active: currentIndex,
      onStepClick: (i) => {
        const s = steps[i]
        if (s) setStep(s)
      },
      tintedStepCard: true,
      escapeAction: !gate.ok && onOffRules ? <OffRulesEscape onEscape={onOffRules} /> : undefined,
      onBack: currentIndex > 0 ? goBack : undefined,
      onCancel: () => {
        clearWizardDraft(draftKey)
        onCancel()
      },
      confirmCancel: formDirty,
      onNext: goNext,
      nextDisabled: !gate.ok,
      busy: isSubmitting,
    },
  }
}
