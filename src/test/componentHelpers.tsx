/**
 * Component test helpers for live sheets
 *
 * Utilities for rendering components and querying/interacting with them in tests
 */

import { screen, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { LOCAL_ID } from '../lib/cacheHelpers'
import PilotLiveSheet from '../components/PilotLiveSheet'
import type { RenderResult } from '@testing-library/react'
import { render } from './render'
import { expect } from 'bun:test'

/**
 * Create a test QueryClient with default options
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Don't cache queries in tests
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Render pilot live sheet with proper providers
 * Note: The render function from test/render.tsx creates its own QueryClient
 * For tests that need to pre-populate cache, use render with setup helpers separately
 */
export function renderPilotLiveSheet(id: string = LOCAL_ID): RenderResult {
  return render(<PilotLiveSheet id={id} />)
}

/**
 * Wait for pilot to load (hydration complete)
 */
export async function waitForPilotToLoad(): Promise<void> {
  await waitFor(
    () => {
      // Check that loading state is gone
      const loadingState = screen.queryByText(/loading/i)
      expect(loadingState).not.toBeInTheDocument()
    },
    { timeout: 5000 }
  )
}

/**
 * Wait for hydration to complete
 */
export async function waitForHydration(): Promise<void> {
  await waitForPilotToLoad()
  // Additional checks can be added here
}

/**
 * Find class select dropdown
 */
export function findClassSelect(): HTMLElement | null {
  const label = screen.queryByText(/class/i)
  if (!label) return null

  // Find the select element near the label
  const container = label.closest('label') || label.parentElement
  if (!container) return null

  return container.querySelector('select') || null
}

/**
 * Find ability button by ability ID or name
 */
export function findAbilityButton(abilityIdOrName: string): HTMLElement | null {
  // Try finding by text first (ability name)
  const buttons = screen.queryAllByRole('button')
  const byText = buttons.find((btn) => btn.textContent?.includes(abilityIdOrName))

  if (byText) return byText

  // Try finding by data attribute if we have that set up
  return document.querySelector(`[data-ability-id="${abilityIdOrName}"]`) as HTMLElement | null
}

/**
 * Find equipment item by equipment ID or name
 */
export function findEquipmentItem(equipmentIdOrName: string): HTMLElement | null {
  // Try finding by text (equipment name)
  const elements = screen.queryAllByText(new RegExp(equipmentIdOrName, 'i'))
  return elements[0] || null
}

/**
 * Find resource stepper (HP, AP, or TP)
 */
export function findResourceStepper(resource: 'hp' | 'ap' | 'tp'): {
  label: HTMLElement | null
  value: HTMLElement | null
  decrement: HTMLElement | null
  increment: HTMLElement | null
} {
  const label = screen.queryByText(new RegExp(resource, 'i'))
  const container = label?.closest('[data-testid]') || label?.parentElement

  if (!container) {
    return {
      label: null,
      value: null,
      decrement: null,
      increment: null,
    }
  }

  const buttons = container.querySelectorAll('button')
  const value = container.querySelector('[data-value]') || container

  return {
    label,
    value: (value as HTMLElement) || null,
    decrement: (buttons[0] as HTMLElement) || null,
    increment: (buttons[1] as HTMLElement) || null,
  }
}

/**
 * Select class from dropdown
 */
export async function selectClass(classId: string): Promise<void> {
  const select = findClassSelect()
  if (!select) {
    throw new Error('Class select not found')
  }

  const selectElement = select as HTMLSelectElement
  selectElement.value = classId
  selectElement.dispatchEvent(new Event('change', { bubbles: true }))
  await waitFor(() => {
    expect(selectElement.value).toBe(classId)
  })
}

/**
 * Add ability via UI (click the add button)
 */
export async function addAbilityViaUI(abilityIdOrName: string): Promise<void> {
  const button = findAbilityButton(abilityIdOrName)
  if (!button) {
    throw new Error(`Ability button not found: ${abilityIdOrName}`)
  }

  const buttonElement = button as HTMLButtonElement
  if (buttonElement.disabled) {
    throw new Error(`Ability button is disabled: ${abilityIdOrName}`)
  }

  button.click()
  await waitFor(() => {
    // Wait for UI to update (button should change to "Remove Ability")
    expect(button.textContent).toMatch(/remove/i)
  })
}

/**
 * Update resource via UI (use stepper)
 */
export async function updateResourceViaUI(
  resource: 'hp' | 'ap' | 'tp',
  action: 'increment' | 'decrement',
  times: number = 1
): Promise<void> {
  const stepper = findResourceStepper(resource)
  if (!stepper.label) {
    throw new Error(`Resource stepper not found: ${resource}`)
  }

  const button = action === 'increment' ? stepper.increment : stepper.decrement
  if (!button) {
    throw new Error(`Stepper ${action} button not found for ${resource}`)
  }

  for (let i = 0; i < times; i++) {
    button.click()
    await waitFor(() => {
      // Wait for state update
      if (stepper.value) {
        expect(stepper.value).toBeInTheDocument()
      }
    })
  }
}

/**
 * Find tab by value
 */
export function findTab(tabValue: string): HTMLElement | null {
  return screen.queryByRole('tab', { name: new RegExp(tabValue, 'i') }) || null
}

/**
 * Click tab
 */
export async function clickTab(tabValue: string): Promise<void> {
  const tab = findTab(tabValue)
  if (!tab) {
    throw new Error(`Tab not found: ${tabValue}`)
  }

  tab.click()
  await waitFor(() => {
    // Tab should be selected
    expect(tab).toHaveAttribute('aria-selected', 'true')
  })
}

/**
 * Find notes textarea
 */
export function findNotesTextarea(): HTMLTextAreaElement | null {
  return screen.queryByPlaceholderText(/notes/i) as HTMLTextAreaElement | null
}

/**
 * Update notes
 */
export async function updateNotes(text: string): Promise<void> {
  const textarea = findNotesTextarea()
  if (!textarea) {
    throw new Error('Notes textarea not found')
  }

  const textareaElement = textarea as HTMLTextAreaElement
  textareaElement.value = text
  textareaElement.dispatchEvent(new Event('input', { bubbles: true }))
  textareaElement.dispatchEvent(new Event('change', { bubbles: true }))

  await waitFor(() => {
    expect(textareaElement.value).toBe(text)
  })
}
