/**
 * useWizardFlow — the step machine and the submit pipeline the pilot, mech and
 * crawler wizards all run.
 *
 * ## What was duplicated
 *
 * `goNext` / `goBack` were byte-identical in all three wizards, and the whole
 * upsert-or-create submit — set busy, branch on the entity id, validate the
 * create input against the Zod schema with a throwaway `id`, join the issue
 * messages into one `Validation error: …` string, toast, clear the draft, hand
 * the id back — was identical between the pilot and the mech and shared most
 * of its body with the crawler.
 *
 * ## Where the crawler genuinely differs, and how it is expressed
 *
 * The crawler is NOT the same submit with a different noun, and flattening it
 * into one would have changed behaviour on both branches:
 *
 *   - UPDATE: it reads the stored record BEFORE the wizard patch (the patch
 *     overwrites `type`, and the old type is needed afterwards), then runs a
 *     second lifecycle write, `applyCrawlerCrewAndTypeEdit`. That is why
 *     `afterUpdate` exists and why it is handed the pre-patch record — a
 *     create-side-only decorate hook would have silently dropped it.
 *   - CREATE: it derives `maxSP` and seeds the default bays. That needs no
 *     hook at all: `toCreateInput` is a closure, so the crawler does that work
 *     inside its own.
 *   - FAILURE COPY: the crawler's catch says "Failed to save crawler." with no
 *     "Please retry." suffix. Rather than quietly normalise three user-visible
 *     strings, `failureMessage` is passed in verbatim.
 *
 * The pre-patch read only happens when `afterUpdate` is supplied, so the pilot
 * and mech submit paths make exactly the store calls they made before.
 */

import { useState } from 'react'
import { toast } from 'component-lib'

import { clearWizardDraft } from '../../lib/wizard/wizardDraft'
import type { EntityState } from '../../stores/entityStore'
import { useEntityStore } from '../../stores/entityStore'
import { WIZARD_TXN } from '../../stores/surfaceProvenance'
import type { AssignableType, CreateInput, EntityForType } from '../../stores/types'

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
  /** The active step list — create and edit flows pass different arrays. */
  steps: readonly TStep[]
  /** First step; the wizards pass `steps[0] ?? <their own fallback>`. */
  initialStep: TStep
  /** The step whose Next is a submit rather than an advance. */
  submitStep: TStep
  form: TForm
  /** Session-draft key, cleared on a successful submit. */
  draftKey: string
  /** Present = edit mode: submit takes the update branch, never a second create. */
  entityId?: string
  /** Validated with a throwaway id before the create write. */
  schema: WizardValidationSchema
  toCreateInput: (form: TForm) => CreateInput<T>
  toUpdatePatch: (form: TForm) => Partial<EntityForType<T>>
  /**
   * Extra lifecycle work on the UPDATE path, run after the wizard patch lands
   * and before the success toast. `before` is the record as it was BEFORE the
   * patch — the crawler needs its old `type`, which the patch overwrites.
   * Omitted (pilot, mech) means no pre-read happens at all.
   */
  afterUpdate?: (
    store: EntityState,
    entityId: string,
    before: EntityForType<T> | null
  ) => Promise<void>
  /** Copy shown when the write throws. Verbatim — the three differ. */
  failureMessage: string
  /** Called with the entity id once the save has landed. */
  onComplete: (entityId: string) => void
}

export type WizardFlow<TStep extends string> = {
  step: TStep
  setStep: (step: TStep) => void
  /** Index of `step` in `steps`; -1 if the step is not in the active list. */
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
  entityId,
  schema,
  toCreateInput,
  toUpdatePatch,
  afterUpdate,
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

      // Upsert branch: update when editing — NEVER a second create.
      if (entityId) {
        // Read the stored record BEFORE the wizard patch, but only when
        // somebody is going to use it (the crawler's old `type`).
        const before = afterUpdate ? store.get(entityType, entityId) : null

        await store.update(entityType, entityId, toUpdatePatch(form), WIZARD_TXN)
        if (afterUpdate) await afterUpdate(store, entityId, before)

        toast.success(`Saved ${form.name.trim() || noun}.`)
        clearWizardDraft(draftKey)
        onComplete(entityId)
        return
      }

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
