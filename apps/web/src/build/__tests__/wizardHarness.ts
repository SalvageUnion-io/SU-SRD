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

/** Exactly-one picks (class, ability, chassis, pattern, crawler type) are radios. */
export async function pickRadio(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name }))
  })
}

/**
 * A pick by its entity name: a radio card, or a toggle SelCard (div[role="button"]).
 * An exact aria-label wins over a card whose text holds the name.
 */
export function getPickByName(name: string): HTMLElement {
  const candidates = [...screen.queryAllByRole('radio'), ...screen.getAllByRole('button')]
  const exact = candidates.find((b) => b.getAttribute('aria-label') === name)
  if (exact) return exact
  const row = candidates.find((b) => (b.textContent ?? '').includes(name))
  if (!row) throw new Error(`No radio or button pick for "${name}"`)
  return row
}

export async function pickByName(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(getPickByName(name))
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
