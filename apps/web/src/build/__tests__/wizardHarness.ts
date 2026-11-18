/**
 * What the Pilot, Mech and Crawler wizard tests share: the real in-memory
 * store, signed in and emptied around each test, and the WizShell's controls.
 */

import { afterEach, beforeEach } from 'bun:test'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
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
    sessionStorage.clear()
    resetStores()
    await useUnits.getState().hydrate(kind)
  })
  afterEach(async () => {
    await act(async () => {
      cleanup()
    })
    sessionStorage.clear()
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

/** A picker's row (`PickList`): the radio its name labels. */
function getPick(name: string): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('radio', { name })
}

/** Whether a picker's row is the picked one. */
export function isPicked(name: string): boolean {
  return getPick(name).checked
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

/** Fill a click-to-edit IdentityField: open, type, and blur to commit. */
export async function fillIdentity(editLabel: string, value: string): Promise<void> {
  await clickButton(editLabel)
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: editLabel })
  await act(async () => {
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input, { target: { value } })
  })
}
