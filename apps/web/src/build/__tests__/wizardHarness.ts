/**
 * What the Pilot, Mech and Crawler wizard tests share: the real in-memory
 * store, signed in and emptied around each test, and the WizShell's controls.
 */

import { afterEach, beforeEach } from 'bun:test'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { draftStorage } from '../../lib/wizard/wizardDraft'
import { resetStores } from '../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../replica/__tests__/signedInBackend'
import type { EntityType } from '../../replica/types'
import { useUnits } from '../../replica/units'

/**
 * Building needs an account (ADR-034 as amended), so writes run signed in; the
 * store and the session draft start empty, with `kind` hydrated.
 */
export function withWizardStore(kind: EntityType): void {
  withSignedInBackend()
  beforeEach(async () => {
    draftStorage().clear()
    resetStores()
    await useUnits.getState().hydrate(kind)
  })
  afterEach(async () => {
    await act(async () => {
      cleanup()
    })
    draftStorage().clear()
    resetStores()
  })
}

/** The primary CTA is labeled from the steps array: 'Next: {step}' (`NextLabel`). */
export function getNextButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: /^Next: / })
}

/** Press a button by its accessible name. */
export async function clickButton(name: string | RegExp): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

export async function clickNext(): Promise<void> {
  await act(async () => {
    fireEvent.click(getNextButton())
  })
}

/** Exactly-one picks (class, ability, chassis, pattern, crawler type) are radios, a row each. */
export async function pickRadio(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name }))
  })
}

/** Whether a picker's row is the picked one: a `PickList` input or a `PictureRadio` plate. */
export function isPicked(name: string): boolean {
  const pick = screen.getByRole('radio', { name })
  return pick instanceof HTMLInputElement
    ? pick.checked
    : pick.getAttribute('aria-checked') === 'true'
}

/** A count pick's stepper (`Stat` in edit): the `+` and `−` of the row named `name`. */
export function getStep(name: string, way: 'Increase' | 'Decrease'): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: `${way} ${name} count` })
}

/** One more copy of a count pick. */
export async function addOne(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(getStep(name, 'Increase'))
  })
}

/** One copy fewer of a count pick. */
export async function removeOne(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(getStep(name, 'Decrease'))
  })
}

/**
 * Type into a wizard's text field, named by its label (any case). No blur:
 * the field is live, so the draft has the value as it is typed.
 */
export async function fillIdentity(label: string, value: string): Promise<void> {
  const name = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\s*\\*?$`, 'i')
  const input = screen.getByRole<HTMLInputElement>('textbox', { name })
  await act(async () => {
    fireEvent.change(input, { target: { value } })
  })
}
