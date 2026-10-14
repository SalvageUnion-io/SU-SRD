/**
 * StarterCard — a Starter Set build's Row opens its read-only sheet, and the
 * entity it is made from (`CLASS | Engineer`, `CHASSIS | Mule`) is a linked
 * chip of its own: it Peeks and opens that entity, outside the sheet's link.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { EntitySurfaceProvider } from 'component-lib'
import { StarterCard } from '../StarterCard'
import { starterShelves } from '../starterShelves.model'

const build = (kind: 'pilot' | 'mech', name: string) => {
  const found = starterShelves()
    .find((shelf) => shelf.kind === kind)
    ?.builds.find((b) => b.name === name)
  if (!found) throw new Error(`fixture missing: ${kind} ${name}`)
  return found
}

describe('StarterCard', () => {
  test("a pilot's class is a linked chip that Peeks and opens the class", () => {
    const openPage = mock(() => {})
    render(
      <EntitySurfaceProvider value={{ openPage }}>
        <StarterCard kind="pilot" build={build('pilot', 'Bonesaw')} />
      </EntitySurfaceProvider>
    )
    const sheet = screen.getByRole('link', { name: 'Read Bonesaw' })
    expect(sheet.getAttribute('href')).toContain('/starter/pilot/')
    const chip = screen.getByRole('button', { name: /class\s*engineer/i })
    // The chip is not inside the sheet's link.
    expect(sheet.contains(chip)).toBe(false)
    expect(chip.hasAttribute('data-peek')).toBe(true)
    fireEvent.click(chip)
    expect(openPage).toHaveBeenCalledTimes(1)
    expect(openPage.mock.calls[0]?.[0]).toMatchObject({ schemaName: 'classes', name: 'Engineer' })
  })

  test("a mech's chassis is a linked chip; its TL stays a plain chip", () => {
    const { container } = render(
      <EntitySurfaceProvider value={{ openPage: () => {} }}>
        <StarterCard kind="mech" build={build('mech', 'Mule')} />
      </EntitySurfaceProvider>
    )
    expect(screen.getByRole('button', { name: /chassis\s*mule/i })).toBeTruthy()
    expect(container.textContent).toMatch(/TL\s*1/)
  })
})
