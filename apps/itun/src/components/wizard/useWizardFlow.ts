/**
 * useWizardFlow — the step machine and the create submit the pilot, mech and
 * crawler wizards all run.
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
 */

import { toast } from 'component-lib'
import { useState } from 'react'
import { clearWizardDraft } from '../../lib/wizard/wizardDraft'
import { useEntityStore } from '../../stores/entityStore'
import type { AssignableType, CreateInput } from '../../stores/types'

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
  /** First step. */
  initialStep: TStep
  /** The step whose Next is a submit rather than an advance. */
  submitStep: TStep
  form: TForm
  /** Session-draft key, cleared on a successful submit. */
  draftKey: string
  /** Validated with a throwaway id before the create write. */
  schema: WizardValidationSchema
  toCreateInput: (form: TForm) => CreateInput<T>
  /** Copy shown when the write throws. Verbatim — the three differ. */
  failureMessage: string
  /** Called with the new entity's id once the create has landed. */
  onComplete: (entityId: string) => void
}

export type WizardFlow<TStep extends string> = {
  step: TStep
  setStep: (step: TStep) => void
  /** Index of `step` in `steps`; -1 if the step is not in it. */
  currentIndex: number
  /** Advance, or submit when already on `submitStep`. */
  goNext: () => void
  goBack: () => void
  isSubmitting: boolean
  submitError: string | null
}

export function useWizardFlow<
  TStep extends string,
  TForm extends { name: string },
  T extends AssignableType,
>({
  entityType,
  noun,
  steps,
  initialStep,
  submitStep,
  form,
  draftKey,
  schema,
  toCreateInput,
  failureMessage,
  onComplete,
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

  return { step, setStep, currentIndex, goNext, goBack, isSubmitting, submitError }
}
